import { query } from "./db.js";

export const CATEGORY_LABELS = {
  index: "Index",
  energy: "Energy",
  metal: "Metals",
  rate: "Rates",
  fx: "FX",
  ag: "Agriculture",
};

export async function listInstruments() {
  return query(
    "SELECT * FROM instruments ORDER BY category, is_micro, symbol"
  );
}

export async function getInstrument(symbol) {
  const rows = await query("SELECT * FROM instruments WHERE symbol = ?", [
    symbol,
  ]);
  return rows[0] || null;
}

// Group instruments by category for <optgroup> rendering.
export function groupByCategory(instruments) {
  const groups = {};
  for (const i of instruments) {
    (groups[i.category] ||= []).push(i);
  }
  return groups;
}
