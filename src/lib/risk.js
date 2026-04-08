// Risk guardrails. Evaluates a proposed trade against an account's rules
// (daily_loss_limit, max_contracts, trailing_dd) and returns structured
// warnings and blockers. Blockers can be overridden by the user with a
// recorded reason.
//
// All rule checks are opt-in per account — if a column is null/0 on the
// account row, the corresponding check is skipped silently. That's the
// contract: users who haven't configured a rule shouldn't be nagged about it.
import { query } from "./db.js";
import { tradeRisk } from "./calc.js";
import { getInstrument, listInstruments } from "./instruments.js";

// ---------- Data fetchers ----------

// Sum of pnl_dollars for trades on this account whose exit_time falls inside
// the given [startISO, endISO] window. Only closed trades contribute because
// only they have realized P&L.
export async function realizedPnlInWindow(accountId, startISO, endISO) {
  const rows = await query(
    `SELECT COALESCE(SUM(pnl_dollars), 0) AS total
       FROM trades
      WHERE account_id = ?
        AND status = 'closed'
        AND exit_time >= ?
        AND exit_time <= ?`,
    [accountId, startISO, endISO]
  );
  return rows[0]?.total || 0;
}

// Realized P&L for the current local calendar day on an account.
export async function dailyPnl(accountId, date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return realizedPnlInWindow(
    accountId,
    start.toISOString(),
    end.toISOString()
  );
}

// Fetch every instrument once and return as a Map keyed by symbol. The
// instruments table is tiny (~17 rows) and never changes at runtime, so
// call this once per render and pass the Map to openTradesWithRisk() to
// avoid N+1 queries when many accounts each have several open trades.
export async function loadInstrumentMap() {
  const rows = await listInstruments();
  const map = new Map();
  for (const r of rows) map.set(r.symbol, r);
  return map;
}

// All open trades on an account with their dollar risk computed. Excludes
// a trade by id (used when editing, to avoid double-counting the trade
// being edited).
//
// Accepts an optional pre-fetched instrumentMap to avoid N+1 queries. When
// omitted it falls back to per-trade getInstrument() calls — acceptable
// for one-off use but not for any render loop over multiple accounts.
export async function openTradesWithRisk(
  accountId,
  { excludeTradeId = null, instrumentMap = null } = {}
) {
  const rows = await query(
    `SELECT * FROM trades WHERE account_id = ? AND status = 'open'`,
    [accountId]
  );
  const open = [];
  for (const t of rows) {
    if (excludeTradeId != null && t.id === excludeTradeId) continue;
    const inst = instrumentMap
      ? instrumentMap.get(t.instrument)
      : await getInstrument(t.instrument);
    const risk = tradeRisk(t, inst);
    open.push({
      trade: t,
      riskDollars: risk ? risk.dollars : 0,
    });
  }
  return open;
}

// Aggregate: total open dollar risk and total open contracts.
export function summarizeOpen(openEntries) {
  let riskDollars = 0;
  let contracts = 0;
  for (const e of openEntries) {
    riskDollars += e.riskDollars || 0;
    contracts += e.trade.contracts || 0;
  }
  return { riskDollars, contracts };
}

// ---------- Evaluation ----------

// Pure function. All inputs are already fetched.
//
// ctx = {
//   account,           // accounts row
//   proposedRisk,      // dollars at risk if stop hits (from tradeRisk())
//   proposedContracts, // contract count for the proposed trade
//   dailyPnl,          // realized P&L so far today on this account
//   openRisk,          // sum of dollar risk across other open trades
//   openContracts,     // sum of contracts across other open trades
// }
//
// Returns: { blockers: Issue[], warnings: Issue[] }
// Each Issue: { code, message, detail? }
export function evaluateTradeRisk(ctx) {
  const blockers = [];
  const warnings = [];

  const {
    account,
    proposedRisk,
    proposedContracts,
    dailyPnl: dpnl,
    openRisk,
    openContracts,
  } = ctx;

  // No account or unusable risk figure? Skip — validateTradeShape already
  // catches shape errors before we get here.
  if (!account) return { blockers, warnings };
  if (!Number.isFinite(proposedRisk) || proposedRisk <= 0) {
    return { blockers, warnings };
  }

  // --- Blockers (opt-in via non-null account columns) ---

  // 1. Daily loss limit. Worst case = today's realized + all open risk hitting
  //    stops + this trade hitting its stop. If that breaches the limit, block.
  const dll = account.daily_loss_limit;
  if (dll != null && dll > 0) {
    const worstCase = dpnl - openRisk - proposedRisk;
    if (worstCase < -dll) {
      const overBy = Math.abs(worstCase) - dll;
      blockers.push({
        code: "daily_loss_limit",
        message:
          `Worst-case today would breach your daily loss limit by ` +
          `$${overBy.toFixed(0)}.`,
        detail:
          `Today realized ${fmtSigned(dpnl)}, open risk $${openRisk.toFixed(0)}, ` +
          `this trade risks $${proposedRisk.toFixed(0)}. Limit is $${dll.toFixed(0)}.`,
      });
    }
  }

  // 2. Max contracts across open positions on the account.
  const maxC = account.max_contracts;
  if (maxC != null && maxC > 0) {
    const total = openContracts + proposedContracts;
    if (total > maxC) {
      blockers.push({
        code: "max_contracts",
        message:
          `${total} contracts open would exceed your max of ${maxC}.`,
        detail: `${openContracts} already open + ${proposedContracts} new.`,
      });
    }
  }

  // 3. Trailing drawdown floor (funded accounts only). If this trade's stop
  //    hits, would the resulting balance breach the floor?
  if (account.type === "funded" && account.trailing_dd != null) {
    const floor = account.account_size - account.trailing_dd;
    // Worst-case balance: current balance minus this trade's risk (open risk
    // is already reflected in the "if they all hit" scenario, but we check
    // this trade's risk alone against the floor, since open trades may close
    // in profit).
    const worstBalance = account.current_balance - proposedRisk;
    if (worstBalance < floor) {
      blockers.push({
        code: "trailing_drawdown",
        message:
          `Stop-out would put the account below its trailing drawdown floor.`,
        detail:
          `Floor $${floor.toFixed(0)}, worst-case balance ` +
          `$${worstBalance.toFixed(0)}.`,
      });
    }
  }

  // --- Warnings (soft) ---

  // 4. Risk > 2% of account size — classic position sizing guideline.
  if (account.account_size > 0) {
    const pct = proposedRisk / account.account_size;
    if (pct > 0.02) {
      warnings.push({
        code: "risk_pct",
        message: `Risking ${(pct * 100).toFixed(1)}% of account size.`,
        detail:
          `$${proposedRisk.toFixed(0)} on a ` +
          `$${account.account_size.toFixed(0)} account. Most sizing rules say <2%.`,
      });
    }
  }

  // 5. Risk alone > 50% of daily loss limit.
  if (dll != null && dll > 0 && proposedRisk > dll * 0.5) {
    warnings.push({
      code: "risk_vs_dll",
      message: `This trade alone risks ${((proposedRisk / dll) * 100).toFixed(
        0
      )}% of your daily loss limit.`,
    });
  }

  return { blockers, warnings };
}

function fmtSigned(n) {
  if (n == null || !Number.isFinite(n)) return "$0";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

// Convenience: fetch everything needed for evaluation on a draft trade,
// then evaluate. Returns { blockers, warnings, computed } where computed
// exposes the intermediate numbers so the UI can show the preview.
//
// Callers should pass a pre-built `instrumentMap` (use loadInstrumentMap
// once per render session) to avoid re-fetching the instruments table on
// every debounced keystroke. If omitted, we load it here as a fallback.
export async function assessDraft({
  account,
  instrument,
  draft,
  excludeTradeId = null,
  instrumentMap = null,
}) {
  const risk = tradeRisk(draft, instrument);
  const proposedRisk = risk ? risk.dollars : 0;
  const proposedContracts = draft.contracts || 0;

  const map = instrumentMap || (await loadInstrumentMap());

  const [dpnl, openEntries] = await Promise.all([
    dailyPnl(account.id),
    openTradesWithRisk(account.id, { excludeTradeId, instrumentMap: map }),
  ]);
  const { riskDollars: openRisk, contracts: openContracts } =
    summarizeOpen(openEntries);

  const result = evaluateTradeRisk({
    account,
    proposedRisk,
    proposedContracts,
    dailyPnl: dpnl,
    openRisk,
    openContracts,
  });

  return {
    ...result,
    computed: {
      proposedRisk,
      proposedContracts,
      dailyPnl: dpnl,
      openRisk,
      openContracts,
      dailyLossLimit: account.daily_loss_limit,
      maxContracts: account.max_contracts,
    },
  };
}
