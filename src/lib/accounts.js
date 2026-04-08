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
  { value: "deposit",    label: "Deposit",    sign: +1 },
  { value: "withdrawal", label: "Withdrawal", sign: -1 },
  { value: "payout",     label: "Payout",     sign: -1 },
  { value: "fee",        label: "Fee",        sign: -1 },
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
  const result = await exec(
    `INSERT INTO accounts (
      name, type, broker, prop_firm, account_size, current_balance,
      trailing_dd, daily_loss_limit, profit_target, max_contracts,
      rules_notes, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      data.name,
      data.type,
      data.broker || null,
      data.prop_firm || null,
      data.account_size,
      data.current_balance ?? data.account_size,
      data.trailing_dd ?? null,
      data.daily_loss_limit ?? null,
      data.profit_target ?? null,
      data.max_contracts ?? null,
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
    "max_contracts",
    "rules_notes",
  ];
  const fields = [];
  const values = [];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(data[k]);
    }
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

export async function addTransaction(
  accountId,
  { type, amount, occurred_at, note }
) {
  const result = await exec(
    `INSERT INTO transactions (account_id, type, amount, occurred_at, note)
     VALUES (?, ?, ?, ?, ?)`,
    [accountId, type, amount, occurred_at, note || null]
  );
  await recomputeBalance(accountId);
  return result.lastInsertId;
}

export async function deleteTransaction(id) {
  const rows = await query(
    "SELECT account_id FROM transactions WHERE id = ?",
    [id]
  );
  if (!rows[0]) return;
  await exec("DELETE FROM transactions WHERE id = ?", [id]);
  await recomputeBalance(rows[0].account_id);
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
    const sign = def ? def.sign : -1;
    txDelta += sign * (r.total || 0);
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

// Funded account "headroom": how much P&L room is left before hitting drawdown.
// Returns nulls for cash accounts or when rules aren't set.
export function computeHeadroom(account) {
  if (account.type !== "funded") {
    return { trailingRoom: null, dailyRoom: null, profitToTarget: null };
  }
  const balance = account.current_balance;
  const start = account.account_size;
  // Trailing drawdown is typically: balance - (peak - dd).
  // Without peak tracking we approximate with start - dd as the floor.
  // This is conservative for accounts that haven't hit a new high yet,
  // and we'll refine when we add daily equity tracking.
  const trailingFloor =
    account.trailing_dd != null ? start - account.trailing_dd : null;
  const trailingRoom =
    trailingFloor != null ? balance - trailingFloor : null;

  const dailyRoom = account.daily_loss_limit; // best-effort placeholder
  const profitToTarget =
    account.profit_target != null
      ? account.profit_target - (balance - start)
      : null;

  return { trailingRoom, dailyRoom, profitToTarget };
}
