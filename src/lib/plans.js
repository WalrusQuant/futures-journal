// Plans data layer.
// A "plan" is a structured pre-trade idea: instrument, direction, entry,
// stop (required), target (required), contracts, thesis. When the plan is
// taken, it links to a trades row via plans.trade_id.
import { query, exec } from "./db.js";
import { plannedRR } from "./calc.js";

export const PLAN_STATUSES = ["active", "taken", "invalidated", "expired"];

export async function listPlans(filters = {}) {
  const where = [];
  const params = [];
  if (filters.status && filters.status !== "all") {
    where.push("p.status = ?");
    params.push(filters.status);
  }
  if (filters.account_id) {
    where.push("p.account_id = ?");
    params.push(filters.account_id);
  }
  const sql = `
    SELECT p.*, a.name AS account_name
    FROM plans p
    JOIN accounts a ON a.id = p.account_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY
      CASE p.status WHEN 'active' THEN 0 ELSE 1 END,
      p.created_at DESC, p.id DESC
  `;
  return query(sql, params);
}

export async function countPlansByStatus() {
  const rows = await query(
    "SELECT status, COUNT(*) AS n FROM plans GROUP BY status"
  );
  const out = { active: 0, taken: 0, invalidated: 0, expired: 0, all: 0 };
  for (const r of rows) {
    out[r.status] = r.n;
    out.all += r.n;
  }
  return out;
}

export async function getPlan(id) {
  const rows = await query(
    `SELECT p.*, a.name AS account_name
     FROM plans p JOIN accounts a ON a.id = p.account_id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function createPlan(data) {
  const rr = plannedRR(data) ?? 0;
  const now = new Date().toISOString();
  const result = await exec(
    `INSERT INTO plans (
      account_id, instrument, direction, entry_price, stop_price,
      target_price, contracts, rr_planned, thesis, status,
      trade_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`,
    [
      data.account_id,
      data.instrument,
      data.direction,
      data.entry_price,
      data.stop_price,
      data.target_price,
      data.contracts,
      rr,
      data.thesis || null,
      now,
      now,
    ]
  );
  return result.lastInsertId;
}

export async function updatePlan(id, data) {
  const existing = await getPlan(id);
  if (!existing) return;
  const merged = { ...existing, ...data };
  const rr = plannedRR(merged) ?? existing.rr_planned ?? 0;
  const now = new Date().toISOString();
  await exec(
    `UPDATE plans SET
       account_id = ?, instrument = ?, direction = ?, entry_price = ?,
       stop_price = ?, target_price = ?, contracts = ?, rr_planned = ?,
       thesis = ?, updated_at = ?
     WHERE id = ?`,
    [
      merged.account_id,
      merged.instrument,
      merged.direction,
      merged.entry_price,
      merged.stop_price,
      merged.target_price,
      merged.contracts,
      rr,
      merged.thesis || null,
      now,
      id,
    ]
  );
}

export async function setPlanStatus(id, status, tradeId = null) {
  const now = new Date().toISOString();
  await exec(
    "UPDATE plans SET status = ?, trade_id = ?, updated_at = ? WHERE id = ?",
    [status, tradeId, now, id]
  );
}

export async function deletePlan(id) {
  await exec("DELETE FROM plans WHERE id = ?", [id]);
}
