import { query, exec } from "./db.js";

export const TAG_CATEGORIES = [
  { value: "strategy",  label: "Strategy"  },
  { value: "setup",     label: "Setup"     },
  { value: "condition", label: "Condition" },
  { value: "mistake",   label: "Mistake"   },
];

export const TAG_COLORS = [
  "#22d177", // profit green
  "#00d4ff", // cyan
  "#a78bfa", // violet
  "#f59e0b", // amber
  "#ec4899", // pink
  "#34d399", // teal
  "#60a5fa", // blue
  "#fbbf24", // yellow
  "#fb7185", // rose
  "#94a3b8", // slate
];

export async function listTags() {
  return query("SELECT * FROM tags ORDER BY category, name");
}

export async function getTag(id) {
  const rows = await query("SELECT * FROM tags WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function createTag({ name, color, category }) {
  const result = await exec(
    "INSERT INTO tags (name, color, category) VALUES (?, ?, ?)",
    [name, color, category]
  );
  return result.lastInsertId;
}

export async function updateTag(id, { name, color, category }) {
  await exec(
    "UPDATE tags SET name = ?, color = ?, category = ? WHERE id = ?",
    [name, color, category, id]
  );
}

export async function deleteTag(id) {
  await exec("DELETE FROM tags WHERE id = ?", [id]);
}

// Trade <-> tag join helpers.
export async function getTradeTags(tradeId) {
  return query(
    `SELECT t.* FROM tags t
     JOIN trade_tags tt ON tt.tag_id = t.id
     WHERE tt.trade_id = ?
     ORDER BY t.name`,
    [tradeId]
  );
}

export async function setTradeTags(tradeId, tagIds) {
  await exec("DELETE FROM trade_tags WHERE trade_id = ?", [tradeId]);
  for (const tid of tagIds) {
    await exec(
      "INSERT INTO trade_tags (trade_id, tag_id) VALUES (?, ?)",
      [tradeId, tid]
    );
  }
}
