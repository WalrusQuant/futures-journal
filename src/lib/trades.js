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
  if (filters.status) {
    where.push("t.status = ?");
    params.push(filters.status);
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
    SELECT t.*, a.name AS account_name
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
      plan_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      confidence = ?, notes = ?, updated_at = ?
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
  await exec("DELETE FROM trades WHERE id = ?", [id]);
  await recomputeBalance(existing.account_id);
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
