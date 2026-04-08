// Trades data layer.
// Any mutation that affects pnl_dollars (create / update / delete a closed
// trade) calls recomputeBalance on the affected account so account balances
// stay consistent without a separate sync step.
import { query, exec } from "./db.js";
import { getInstrument } from "./instruments.js";
import { tradePnL, rMultiple } from "./calc.js";
import { recomputeBalance } from "./accounts.js";

export async function listTrades(filters = {}) {
  const where = [];
  const params = [];
  if (filters.account_id) {
    where.push("t.account_id = ?");
    params.push(filters.account_id);
  }
  if (filters.instrument) {
    where.push("t.instrument = ?");
    params.push(filters.instrument);
  }
  if (filters.needsReview) {
    // "Needs review" implies closed — it takes precedence over any
    // conflicting status filter rather than AND-ing the two together
    // (which would produce an empty set when status='open').
    where.push("t.status = 'closed'");
    where.push("t.review_completed = 0");
  } else if (filters.status) {
    where.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters.planned === "planned") {
    where.push("t.plan_id IS NOT NULL");
  } else if (filters.planned === "unplanned") {
    where.push("t.plan_id IS NULL");
  }
  if (filters.from) {
    where.push("t.entry_time >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("t.entry_time <= ?");
    params.push(filters.to);
  }
  const sql = `
    SELECT t.*, a.name AS account_name,
      (SELECT GROUP_CONCAT(tg.name, '|')
         FROM trade_tags tt JOIN tags tg ON tg.id = tt.tag_id
         WHERE tt.trade_id = t.id) AS tag_names,
      (SELECT GROUP_CONCAT(tg.color, '|')
         FROM trade_tags tt JOIN tags tg ON tg.id = tt.tag_id
         WHERE tt.trade_id = t.id) AS tag_colors
    FROM trades t
    JOIN accounts a ON a.id = t.account_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY t.entry_time DESC, t.id DESC
  `;
  return query(sql, params);
}

export async function getTrade(id) {
  const rows = await query(
    `SELECT t.*, a.name AS account_name
     FROM trades t JOIN accounts a ON a.id = t.account_id
     WHERE t.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function createTrade(data) {
  const computed = await computePnLFields(data);
  const now = new Date().toISOString();
  const result = await exec(
    `INSERT INTO trades (
      account_id, instrument, direction, entry_time, entry_price,
      stop_price, target_price, contracts, exit_time, exit_price, fees,
      pnl_points, pnl_dollars, r_multiple, status, confidence, notes,
      plan_id, risk_override, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.account_id,
      data.instrument,
      data.direction,
      data.entry_time,
      data.entry_price,
      data.stop_price,
      data.target_price ?? null,
      data.contracts,
      data.exit_time ?? null,
      data.exit_price ?? null,
      data.fees ?? 0,
      computed.pnl_points,
      computed.pnl_dollars,
      computed.r_multiple,
      computed.status,
      data.confidence ?? null,
      data.notes || null,
      data.plan_id ?? null,
      data.risk_override ?? null,
      now,
      now,
    ]
  );
  if (computed.status === "closed") {
    await recomputeBalance(data.account_id);
  }
  return result.lastInsertId;
}

export async function updateTrade(id, data) {
  const existing = await getTrade(id);
  if (!existing) return;
  const merged = { ...existing, ...data };
  const computed = await computePnLFields(merged);
  const now = new Date().toISOString();
  await exec(
    `UPDATE trades SET
      account_id = ?, instrument = ?, direction = ?, entry_time = ?,
      entry_price = ?, stop_price = ?, target_price = ?, contracts = ?,
      exit_time = ?, exit_price = ?, fees = ?,
      pnl_points = ?, pnl_dollars = ?, r_multiple = ?, status = ?,
      confidence = ?, notes = ?, risk_override = ?, updated_at = ?
     WHERE id = ?`,
    [
      merged.account_id,
      merged.instrument,
      merged.direction,
      merged.entry_time,
      merged.entry_price,
      merged.stop_price,
      merged.target_price ?? null,
      merged.contracts,
      merged.exit_time ?? null,
      merged.exit_price ?? null,
      merged.fees ?? 0,
      computed.pnl_points,
      computed.pnl_dollars,
      computed.r_multiple,
      computed.status,
      merged.confidence ?? null,
      merged.notes || null,
      merged.risk_override ?? null,
      now,
      id,
    ]
  );
  await recomputeBalance(merged.account_id);
  if (existing.account_id !== merged.account_id) {
    await recomputeBalance(existing.account_id);
  }
}

export async function deleteTrade(id) {
  const existing = await getTrade(id);
  if (!existing) return;
  // Any plans linked to this trade should revert to active so they can be
  // re-taken. We don't have a real FK ON DELETE rule for this column.
  await exec(
    "UPDATE plans SET status = 'active', trade_id = NULL, updated_at = ? WHERE trade_id = ?",
    [new Date().toISOString(), id]
  );
  await exec("DELETE FROM trades WHERE id = ?", [id]);
  await recomputeBalance(existing.account_id);
}

// ---------- Review ----------

export const EMOTIONAL_STATES = [
  "calm",
  "neutral",
  "anxious",
  "angry",
  "overconfident",
];

// Save a structured post-trade review. Any field may be null — only
// review_completed and reviewed_at are always set. Idempotent: safe to call
// again to update an existing review.
export async function setReview(tradeId, data) {
  const now = new Date().toISOString();
  await exec(
    `UPDATE trades SET
       review_completed = 1,
       plan_followed    = ?,
       exit_discipline  = ?,
       emotional_state  = ?,
       lessons          = ?,
       reviewed_at      = ?
     WHERE id = ?`,
    [
      data.plan_followed == null ? null : data.plan_followed ? 1 : 0,
      data.exit_discipline ?? null,
      data.emotional_state || null,
      data.lessons || null,
      now,
      tradeId,
    ]
  );
}

// Mark a trade as "needs review again" — clears the flag without wiping the
// stored review fields, so the user can re-review without losing context.
export async function clearReview(tradeId) {
  await exec(
    `UPDATE trades SET review_completed = 0, reviewed_at = NULL WHERE id = ?`,
    [tradeId]
  );
}

// Closed trades that haven't been reviewed. Optionally scoped to an account.
// Orders newest-first so the most recent unreviewed work floats to the top.
export async function listTradesNeedingReview({ accountId, limit = null } = {}) {
  const where = ["t.status = 'closed'", "t.review_completed = 0"];
  const params = [];
  if (accountId) {
    where.push("t.account_id = ?");
    params.push(accountId);
  }
  const lim = limit ? `LIMIT ${Number(limit)}` : "";
  return query(
    `SELECT t.*, a.name AS account_name
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
      WHERE ${where.join(" AND ")}
      ORDER BY t.exit_time DESC, t.id DESC
      ${lim}`,
    params
  );
}

export async function countTradesNeedingReview({ accountId } = {}) {
  const where = ["status = 'closed'", "review_completed = 0"];
  const params = [];
  if (accountId) {
    where.push("account_id = ?");
    params.push(accountId);
  }
  const rows = await query(
    `SELECT COUNT(*) AS n FROM trades WHERE ${where.join(" AND ")}`,
    params
  );
  return rows[0]?.n || 0;
}

async function computePnLFields(trade) {
  const closed = trade.exit_price != null && trade.exit_time != null;
  if (!closed) {
    return {
      pnl_points: null,
      pnl_dollars: null,
      r_multiple: null,
      status: "open",
    };
  }
  const inst = await getInstrument(trade.instrument);
  const pnl = tradePnL(trade, inst);
  const r = rMultiple(trade, inst);
  return {
    pnl_points: pnl?.points ?? null,
    pnl_dollars: pnl?.dollars ?? null,
    r_multiple: r ?? null,
    status: "closed",
  };
}
