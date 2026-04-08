// Accounts data layer.
// All current_balance writes go through recomputeBalance so the stored value
// stays consistent with starting size + transactions + closed-trade P&L.
import { query, exec } from "./db.js";

export const PROP_FIRMS = [
  "Apex Trader Funding",
  "Topstep",
  "My Funded Futures",
  "Tradeify",
  "Take Profit Trader",
  "Bulenox",
  "Earn2Trade",
  "Lucid Trading",
  "FundedNext Futures",
  "Other",
];

export const BROKERS = [
  "Tradovate",
  "NinjaTrader",
  "Interactive Brokers",
  "TradeStation",
  "AMP Futures",
  "Optimus Futures",
  "Charles Schwab",
  "E*TRADE",
  "Other",
];

export const TX_TYPES = [
  { value: "deposit",      label: "Deposit",      sign: +1 },
  { value: "withdrawal",   label: "Withdrawal",   sign: -1 },
  { value: "payout",       label: "Payout",       sign: -1 },
  { value: "fee",          label: "Fee",          sign: -1 },
  { value: "activation",   label: "Activation",   sign: -1 },
  { value: "reset",        label: "Reset fee",    sign: -1 },
  { value: "transfer_out", label: "Transfer out", sign: -1 },
  { value: "transfer_in",  label: "Transfer in",  sign: +1 },
];

// Transaction types the user can enter manually via the transaction form.
// Transfers are created via the separate transfer modal (because they
// insert two linked rows atomically), so they're excluded from this list.
export const MANUAL_TX_TYPES = TX_TYPES.filter(
  (t) => t.value !== "transfer_out" && t.value !== "transfer_in"
);

// Account category — the granular classification used by analytics, the
// real-money ledger, and the UI. The legacy `type` column (funded|cash)
// stays in place for the rule engine; `type` is derived from category
// via the `type` field on each entry so the two columns cannot drift.
//
// See feedback_prop_firm_rules memory: firm-specific rules live on the
// account, never in code. Category is the generic mechanism.
export const ACCOUNT_CATEGORIES = [
  {
    value: "combine",
    label: "Combine / Evaluation",
    type: "funded",
    desc:
      "Simulated trades, pay a monthly subscription to the firm. Failing archives the account.",
  },
  {
    value: "sim_funded",
    label: "Sim funded",
    type: "funded",
    desc:
      "Simulated trades, real payouts. Drawdown and daily loss rules still enforced by the firm.",
  },
  {
    value: "live_funded",
    label: "Live funded",
    type: "funded",
    desc:
      "Real fills with the firm's capital. P&L only counts toward your real-money ledger when withdrawn.",
  },
  {
    value: "cash",
    label: "Cash brokerage",
    type: "cash",
    desc:
      "Your own money at a real broker. No prop-firm rules apply; trades go straight to the real ledger.",
  },
  {
    value: "bank",
    label: "Personal bank",
    type: "cash",
    desc:
      "Central real-money hub. Receives payouts from funded accounts, funds subscriptions and transfers to cash brokerages. No trading.",
  },
];

// Returns the ACCOUNT_CATEGORIES row for a given value, or null.
export function categoryDef(value) {
  return ACCOUNT_CATEGORIES.find((c) => c.value === value) || null;
}

// Derive the legacy `type` field from a category value. Keeps the two
// columns from drifting and means UI code only has to set category.
export function categoryToType(value) {
  return categoryDef(value)?.type || "cash";
}

// Drawdown calculation modes. Stored on accounts.drawdown_mode.
// Rule mechanisms are generic — firm-specific policies are modeled by
// combining a mode with trailing_dd, dd_lock_offset, and dd_lock_on_payout.
// See feedback_prop_firm_rules memory: never hardcode per-firm logic.
export const DRAWDOWN_MODES = [
  {
    value: "static",
    label: "Static",
    desc: "Fixed floor from the account's starting balance. Never moves.",
  },
  {
    value: "eod_trailing",
    label: "End-of-day trailing",
    desc:
      "Floor trails the highest end-of-day balance. Intraday swings don't advance the peak.",
  },
  {
    value: "intraday_trailing",
    label: "Intraday trailing",
    desc:
      "Floor trails the highest running balance after every closed trade. Honest proxy without tick data.",
  },
  {
    value: "none",
    label: "No drawdown rule",
    desc: "Cash or personal accounts with no drawdown constraint.",
  },
];

export async function listAccounts({ includeArchived = false } = {}) {
  if (includeArchived) {
    return query(
      "SELECT * FROM accounts ORDER BY is_active DESC, name ASC"
    );
  }
  return query(
    "SELECT * FROM accounts WHERE is_active = 1 ORDER BY name ASC"
  );
}

export async function getAccount(id) {
  const rows = await query("SELECT * FROM accounts WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function createAccount(data) {
  const now = new Date().toISOString();
  // Category is the source of truth for the granular label. `type`
  // (funded|cash) is derived so the rule engine can keep reading it.
  const category = data.category || (data.type === "cash" ? "cash" : "sim_funded");
  const type = categoryToType(category);
  const result = await exec(
    `INSERT INTO accounts (
      name, type, category, broker, prop_firm, account_size, current_balance,
      trailing_dd, daily_loss_limit, profit_target,
      max_minis, max_micros,
      drawdown_mode, dd_lock_offset, dd_lock_on_payout, consistency_pct,
      rules_notes, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      data.name,
      type,
      category,
      data.broker || null,
      data.prop_firm || null,
      data.account_size,
      data.current_balance ?? data.account_size,
      data.trailing_dd ?? null,
      data.daily_loss_limit ?? null,
      data.profit_target ?? null,
      data.max_minis ?? null,
      data.max_micros ?? null,
      data.drawdown_mode || "static",
      data.dd_lock_offset ?? null,
      data.dd_lock_on_payout ? 1 : 0,
      data.consistency_pct ?? null,
      data.rules_notes || null,
      now,
    ]
  );
  return result.lastInsertId;
}

export async function updateAccount(id, data) {
  const allowed = [
    "name",
    "broker",
    "prop_firm",
    "account_size",
    "trailing_dd",
    "daily_loss_limit",
    "profit_target",
    "max_minis",
    "max_micros",
    "drawdown_mode",
    "dd_lock_offset",
    "dd_lock_on_payout",
    "consistency_pct",
    "category",
    "rules_notes",
  ];
  const fields = [];
  const values = [];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      fields.push(`${k} = ?`);
      // dd_lock_on_payout is a boolean in JS, stored as 0/1 in SQLite.
      if (k === "dd_lock_on_payout") {
        values.push(data[k] ? 1 : 0);
      } else {
        values.push(data[k]);
      }
    }
  }
  // When the caller changes category, also update the derived `type`
  // field so the rule engine reads a consistent value. This is the only
  // write path where the two columns get synced.
  if (data.category !== undefined) {
    fields.push("type = ?");
    values.push(categoryToType(data.category));
  }
  if (!fields.length) return;
  values.push(id);
  await exec(`UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`, values);
  // account_size changes affect computed balance.
  if (data.account_size !== undefined) {
    await recomputeBalance(id);
  }
}

export async function archiveAccount(id) {
  await exec(
    "UPDATE accounts SET is_active = 0, archived_at = ? WHERE id = ?",
    [new Date().toISOString(), id]
  );
}

export async function unarchiveAccount(id) {
  await exec(
    "UPDATE accounts SET is_active = 1, archived_at = NULL WHERE id = ?",
    [id]
  );
}

export async function listTransactions(accountId) {
  return query(
    "SELECT * FROM transactions WHERE account_id = ? ORDER BY occurred_at DESC, id DESC",
    [accountId]
  );
}

// All transactions across every account — used by the real-money ledger.
// Single query; the ledger computation is pure and does its own filtering
// by account category.
export async function listAllTransactions() {
  return query(
    "SELECT * FROM transactions ORDER BY occurred_at ASC, id ASC"
  );
}

export async function addTransaction(
  accountId,
  { type, amount, occurred_at, note, paid_for_account_id = null }
) {
  const result = await exec(
    `INSERT INTO transactions (account_id, type, amount, occurred_at, note, paid_for_account_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [accountId, type, amount, occurred_at, note || null, paid_for_account_id]
  );
  await recomputeBalance(accountId);
  return result.lastInsertId;
}

// Atomic paired transfer: inserts a transfer_out row on the source
// account and a transfer_in row on the destination account, links them
// via linked_tx_id, and recomputes both balances. If either insert
// fails, the half-applied state is cleaned up.
export async function createTransfer({
  from_account_id,
  to_account_id,
  amount,
  occurred_at,
  note = null,
}) {
  if (from_account_id === to_account_id) {
    throw new Error("Transfer source and destination must differ.");
  }
  if (!(amount > 0)) {
    throw new Error("Transfer amount must be positive.");
  }

  // Insert source side first, then destination, then back-link.
  const outResult = await exec(
    `INSERT INTO transactions
       (account_id, type, amount, occurred_at, note)
     VALUES (?, 'transfer_out', ?, ?, ?)`,
    [from_account_id, amount, occurred_at, note]
  );
  const outId = outResult.lastInsertId;

  let inId;
  try {
    const inResult = await exec(
      `INSERT INTO transactions
         (account_id, type, amount, occurred_at, note, linked_tx_id)
       VALUES (?, 'transfer_in', ?, ?, ?, ?)`,
      [to_account_id, amount, occurred_at, note, outId]
    );
    inId = inResult.lastInsertId;
    await exec("UPDATE transactions SET linked_tx_id = ? WHERE id = ?", [
      inId,
      outId,
    ]);
  } catch (err) {
    // Roll back the orphaned out-row so we never leave a half transfer.
    await exec("DELETE FROM transactions WHERE id = ?", [outId]);
    throw err;
  }

  await recomputeBalance(from_account_id);
  await recomputeBalance(to_account_id);
  return { outId, inId };
}

export async function deleteTransaction(id) {
  const rows = await query(
    "SELECT account_id, linked_tx_id FROM transactions WHERE id = ?",
    [id]
  );
  if (!rows[0]) return;
  const { account_id, linked_tx_id } = rows[0];
  // Linked transfers: delete both sides together so the ledger never
  // ends up with an orphaned half-row. Clear back-links first to avoid
  // the FK dangling mid-delete.
  if (linked_tx_id) {
    const sibling = await query(
      "SELECT account_id FROM transactions WHERE id = ?",
      [linked_tx_id]
    );
    await exec(
      "UPDATE transactions SET linked_tx_id = NULL WHERE id IN (?, ?)",
      [id, linked_tx_id]
    );
    await exec("DELETE FROM transactions WHERE id IN (?, ?)", [
      id,
      linked_tx_id,
    ]);
    await recomputeBalance(account_id);
    if (sibling[0]) await recomputeBalance(sibling[0].account_id);
    return;
  }
  await exec("DELETE FROM transactions WHERE id = ?", [id]);
  await recomputeBalance(account_id);
}

// Pure derivation: starting size + signed transactions + closed-trade dollar P&L.
export async function recomputeBalance(accountId) {
  const acct = await getAccount(accountId);
  if (!acct) return;

  const txRows = await query(
    `SELECT type, COALESCE(SUM(amount), 0) AS total
       FROM transactions WHERE account_id = ? GROUP BY type`,
    [accountId]
  );
  let txDelta = 0;
  for (const r of txRows) {
    const def = TX_TYPES.find((t) => t.value === r.type);
    if (!def) {
      // Loud failure beats silent corruption. If the schema CHECK is
      // ever widened without updating TX_TYPES, balances would silently
      // go wrong with the old `?? -1` default. Throwing surfaces it.
      throw new Error(`Unknown transaction type in account ${accountId}: ${r.type}`);
    }
    txDelta += def.sign * (r.total || 0);
  }

  const tradeRows = await query(
    `SELECT COALESCE(SUM(pnl_dollars), 0) AS total
       FROM trades WHERE account_id = ? AND status = 'closed'`,
    [accountId]
  );
  const tradeDelta = tradeRows[0]?.total || 0;

  const newBalance = acct.account_size + txDelta + tradeDelta;
  await exec("UPDATE accounts SET current_balance = ? WHERE id = ?", [
    newBalance,
    accountId,
  ]);
  return newBalance;
}

// ---------- Drawdown floor computation ----------
//
// Single source of truth for where an account's drawdown floor sits right
// now. Used by computeHeadroom (for UI) and by risk.js (for the pre-trade
// blocker), so both always agree.
//
// Pure function: caller provides the account row plus the closed trades
// and transactions for that account. No DB access here. Callers should
// batch-load via loadAccountRiskContext to avoid N+1.
//
// Returns null when the account has no drawdown rule (mode 'none' or
// trailing_dd unset). Otherwise:
//   {
//     mode:      'static' | 'eod_trailing' | 'intraday_trailing',
//     floor:     balance level below which the rule is breached,
//     peak:      highest balance the floor has trailed from (== start for static),
//     locked:    true if the lock rule has tripped and the floor is frozen,
//     lockFloor: the balance level the floor is frozen at (== start + dd_lock_offset),
//   }
//
// Lock semantics (see feedback_prop_firm_rules memory — rule values live on
// the account, not in code):
//   - dd_lock_offset null      → no lock rule; floor keeps trailing forever.
//   - dd_lock_offset >= 0      → once peak reaches (start + dd + offset), the
//                                 floor freezes at (start + offset). offset=0
//                                 is the combine behavior; offset=100 is the
//                                 typical sim-funded behavior.
//   - dd_lock_on_payout = 1    → ALSO triggers the lock the instant any
//                                 withdrawal or payout transaction lands in
//                                 the event stream, regardless of peak. Used
//                                 by sim-funded accounts where realizing
//                                 profit permanently freezes the trailing
//                                 rule.
export function computeDrawdownFloor(
  account,
  trades = [],
  transactions = []
) {
  const mode = account.drawdown_mode || "static";
  if (mode === "none") return null;
  if (account.trailing_dd == null) return null;

  const start = account.account_size;
  const dd = account.trailing_dd;
  const hasLockRule = account.dd_lock_offset != null;
  const lockOffset = hasLockRule ? account.dd_lock_offset : 0;
  const lockThreshold = hasLockRule ? start + dd + lockOffset : null;
  const lockFloor = start + lockOffset;
  const lockOnPayout = !!account.dd_lock_on_payout;

  if (mode === "static") {
    // Static mode ignores history entirely — floor is always start - dd.
    // Lock rules are meaningless here (floor is already fixed), so we
    // just report locked=false.
    return {
      mode,
      floor: start - dd,
      peak: start,
      locked: false,
      lockFloor: null,
    };
  }

  // Trailing modes: build a time-ordered event stream of things that
  // move the balance. Closed trades contribute their pnl_dollars at
  // exit_time. Transactions contribute signed amounts at occurred_at.
  // Events are tagged with kind/tx_type so the walk can detect payouts
  // and withdrawals for the dd_lock_on_payout trigger.
  const events = [];
  for (const tx of transactions) {
    const def = TX_TYPES.find((d) => d.value === tx.type);
    const sign = def ? def.sign : -1;
    events.push({
      t: tx.occurred_at,
      delta: sign * (tx.amount || 0),
      kind: "tx",
      tx_type: tx.type,
    });
  }
  for (const tr of trades) {
    if (
      tr.status !== "closed" ||
      !tr.exit_time ||
      tr.pnl_dollars == null
    ) {
      continue;
    }
    events.push({ t: tr.exit_time, delta: tr.pnl_dollars, kind: "trade" });
  }
  events.sort((a, b) =>
    a.t < b.t ? -1 : a.t > b.t ? 1 : 0
  );

  let running = start;
  let peak = start;
  let locked = false;
  const maybeLock = () => {
    if (!hasLockRule || locked) return;
    if (peak >= lockThreshold) locked = true;
  };
  const checkPayoutLock = (e) => {
    if (!lockOnPayout || locked) return;
    if (
      e.kind === "tx" &&
      (e.tx_type === "withdrawal" || e.tx_type === "payout")
    ) {
      locked = true;
    }
  };

  if (mode === "intraday_trailing") {
    // Peak advances after every event.
    for (const e of events) {
      running += e.delta;
      if (running > peak) peak = running;
      maybeLock();
      checkPayoutLock(e);
    }
  } else if (mode === "eod_trailing") {
    // Peak only samples end-of-day balances. Walk events in order, and
    // whenever the session date rolls over, the previous day's closing
    // balance becomes a peak candidate. Payout-triggered lock still
    // fires intraday — the lock rule is independent of the peak cadence.
    let currentDay = null;
    let dayEndBalance = start;
    for (const e of events) {
      const day = ddLocalDateKey(e.t);
      if (currentDay === null) {
        currentDay = day;
      } else if (day !== currentDay) {
        if (dayEndBalance > peak) peak = dayEndBalance;
        maybeLock();
        currentDay = day;
      }
      running += e.delta;
      dayEndBalance = running;
      checkPayoutLock(e);
    }
    // Final day's EOD snapshot.
    if (currentDay !== null && dayEndBalance > peak) peak = dayEndBalance;
    maybeLock();
  }

  const floor = locked ? lockFloor : peak - dd;
  return { mode, floor, peak, locked, lockFloor: hasLockRule ? lockFloor : null };
}

// Local date key ("YYYY-MM-DD" in local tz) for session-date bucketing.
// Mirrors analytics.js::localDateKey; inlined to keep this module free of
// cross-module imports inside pure math.
function ddLocalDateKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Funded account "headroom": how much room is left before hitting the
// drawdown floor, the daily loss limit, and the profit target.
//
// Synchronous and pure. Pass the account's closed trades and transactions
// via options so dashboards can batch-load once and avoid N+1 queries.
// Trailing modes need these; static/none ignore them.
//
// Returns nulls for non-funded accounts or when the relevant rule isn't
// configured.
export function computeHeadroom(
  account,
  { trades = [], transactions = [] } = {}
) {
  if (account.type !== "funded") {
    return {
      trailingRoom: null,
      dailyRoom: null,
      profitToTarget: null,
      drawdown: null,
    };
  }
  const balance = account.current_balance;
  const start = account.account_size;

  const drawdown = computeDrawdownFloor(account, trades, transactions);
  const trailingRoom = drawdown ? balance - drawdown.floor : null;

  const dailyRoom = account.daily_loss_limit; // best-effort placeholder
  const profitToTarget =
    account.profit_target != null
      ? account.profit_target - (balance - start)
      : null;

  return { trailingRoom, dailyRoom, profitToTarget, drawdown };
}

// Batched loader: for a list of accounts, fetch the closed trades and
// transactions grouped by account_id in exactly two queries. Use this
// from pages that render headroom for multiple accounts (dashboard,
// accounts list) to avoid N+1.
//
// Returns a Map keyed by account id: { trades: [], transactions: [] }.
export async function loadAccountRiskContext(accounts) {
  const ids = accounts.map((a) => a.id);
  const ctx = new Map();
  for (const a of accounts) {
    ctx.set(a.id, { trades: [], transactions: [] });
  }
  if (!ids.length) return ctx;

  const placeholders = ids.map(() => "?").join(",");
  const [tradeRows, txRows] = await Promise.all([
    query(
      `SELECT account_id, status, exit_time, pnl_dollars
         FROM trades
        WHERE account_id IN (${placeholders})
          AND status = 'closed'
          AND exit_time IS NOT NULL
          AND pnl_dollars IS NOT NULL`,
      ids
    ),
    query(
      `SELECT account_id, type, amount, occurred_at
         FROM transactions
        WHERE account_id IN (${placeholders})`,
      ids
    ),
  ]);
  for (const r of tradeRows) {
    ctx.get(r.account_id)?.trades.push(r);
  }
  for (const r of txRows) {
    ctx.get(r.account_id)?.transactions.push(r);
  }
  return ctx;
}
