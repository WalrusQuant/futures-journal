// Risk guardrails. Evaluates a proposed trade against an account's rules
// (daily_loss_limit, max_minis, max_micros, drawdown floor) and returns
// structured warnings and blockers. Blockers can be overridden by the
// user with a recorded reason.
//
// All rule checks are opt-in per account — if a column is null/0 on the
// account row, the corresponding check is skipped silently. That's the
// contract: users who haven't configured a rule shouldn't be nagged about it.
import { query } from "./db.js";
import { tradeRisk } from "./calc.js";
import { getInstrument, listInstruments } from "./instruments.js";
import { computeDrawdownFloor } from "./accounts.js";
import { fmtMoney } from "./format.js";

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
      isMicro: !!inst?.is_micro,
    });
  }
  return open;
}

// Aggregate: total open dollar risk, total open contracts, and the
// mini/micro breakdown so callers can enforce independent caps.
export function summarizeOpen(openEntries) {
  let riskDollars = 0;
  let contracts = 0;
  let minis = 0;
  let micros = 0;
  for (const e of openEntries) {
    riskDollars += e.riskDollars || 0;
    const n = e.trade.contracts || 0;
    contracts += n;
    if (e.isMicro) micros += n;
    else minis += n;
  }
  return { riskDollars, contracts, minis, micros };
}

// ---------- Evaluation ----------

// Pure function. All inputs are already fetched.
//
// ctx = {
//   account,           // accounts row
//   proposedRisk,      // dollars at risk if stop hits (from tradeRisk())
//   proposedContracts, // contract count for the proposed trade
//   proposedIsMicro,   // true if the proposed trade's instrument is a micro
//   dailyPnl,          // realized P&L so far today on this account
//   openRisk,          // sum of dollar risk across other open trades
//   openContracts,     // sum of contracts across other open trades
//   openMinis,         // sum of mini contracts across other open trades
//   openMicros,        // sum of micro contracts across other open trades
//   drawdown,          // result of computeDrawdownFloor() or null if no rule
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
    proposedIsMicro,
    dailyPnl: dpnl,
    openRisk,
    openContracts,
    openMinis = 0,
    openMicros = 0,
    drawdown,
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
          `${fmtMoney(overBy)}.`,
        detail:
          `Today realized ${fmtMoney(dpnl, { signed: true })}, open risk ${fmtMoney(openRisk)}, ` +
          `this trade risks ${fmtMoney(proposedRisk)}. Limit is ${fmtMoney(dll)}.`,
      });
    }
  }

  // 2. Max contracts — independent caps for minis and micros. Firms
  //    size these separately ("4 ES AND 40 MES"), so we check only the
  //    cap that matches the proposed instrument's category.
  const maxMinis = account.max_minis;
  const maxMicros = account.max_micros;
  if (!proposedIsMicro && maxMinis != null && maxMinis > 0) {
    const total = openMinis + proposedContracts;
    if (total > maxMinis) {
      blockers.push({
        code: "max_minis",
        message:
          `${total} mini contracts open would exceed your max of ${maxMinis}.`,
        detail: `${openMinis} already open + ${proposedContracts} new.`,
      });
    }
  }
  if (proposedIsMicro && maxMicros != null && maxMicros > 0) {
    const total = openMicros + proposedContracts;
    if (total > maxMicros) {
      blockers.push({
        code: "max_micros",
        message:
          `${total} micro contracts open would exceed your max of ${maxMicros}.`,
        detail: `${openMicros} already open + ${proposedContracts} new.`,
      });
    }
  }

  // 3. Drawdown floor (funded accounts with a drawdown rule). If this
  //    trade's stop hits, would the resulting balance breach the floor?
  //    The floor itself depends on the account's drawdown_mode (static,
  //    eod_trailing, intraday_trailing) and is pre-computed upstream in
  //    assessDraft. We check this trade's risk alone against the floor,
  //    not combined with open-trade risk, because open trades may still
  //    close in profit.
  if (account.type === "funded" && drawdown) {
    const worstBalance = account.current_balance - proposedRisk;
    if (worstBalance < drawdown.floor) {
      const modeLabel = drawdownModeLabel(drawdown.mode);
      blockers.push({
        code: "trailing_drawdown",
        message:
          `Stop-out would put the account below its ${modeLabel} drawdown floor.`,
        detail:
          `Floor ${fmtMoney(drawdown.floor)}` +
          (drawdown.mode !== "static"
            ? ` (peak ${fmtMoney(drawdown.peak)}${
                drawdown.locked ? ", locked at start" : ""
              })`
            : "") +
          `, worst-case balance ${fmtMoney(worstBalance)}.`,
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
          `${fmtMoney(proposedRisk)} on a ` +
          `${fmtMoney(account.account_size)} account. Most sizing rules say <2%.`,
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

function drawdownModeLabel(mode) {
  if (mode === "eod_trailing") return "end-of-day trailing";
  if (mode === "intraday_trailing") return "intraday trailing";
  return "static";
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
  const proposedIsMicro = !!instrument?.is_micro;

  const map = instrumentMap || (await loadInstrumentMap());

  // Drawdown context: for trailing modes, computeDrawdownFloor needs this
  // account's closed trades and transactions. For static/none it reads
  // nothing from these arrays but it's cheap enough to always fetch.
  // Scoped to a single account so no IN(...) needed.
  const [dpnl, openEntries, ddTrades, ddTx] = await Promise.all([
    dailyPnl(account.id),
    openTradesWithRisk(account.id, { excludeTradeId, instrumentMap: map }),
    query(
      `SELECT status, exit_time, pnl_dollars
         FROM trades
        WHERE account_id = ?
          AND status = 'closed'
          AND exit_time IS NOT NULL
          AND pnl_dollars IS NOT NULL`,
      [account.id]
    ),
    query(
      `SELECT type, amount, occurred_at
         FROM transactions
        WHERE account_id = ?`,
      [account.id]
    ),
  ]);
  const {
    riskDollars: openRisk,
    contracts: openContracts,
    minis: openMinis,
    micros: openMicros,
  } = summarizeOpen(openEntries);
  const drawdown = computeDrawdownFloor(account, ddTrades, ddTx);

  const result = evaluateTradeRisk({
    account,
    proposedRisk,
    proposedContracts,
    proposedIsMicro,
    dailyPnl: dpnl,
    openRisk,
    openContracts,
    openMinis,
    openMicros,
    drawdown,
  });

  return {
    ...result,
    computed: {
      proposedRisk,
      proposedContracts,
      proposedIsMicro,
      dailyPnl: dpnl,
      openRisk,
      openContracts,
      openMinis,
      openMicros,
      dailyLossLimit: account.daily_loss_limit,
      maxMinis: account.max_minis,
      maxMicros: account.max_micros,
      drawdown,
    },
  };
}
