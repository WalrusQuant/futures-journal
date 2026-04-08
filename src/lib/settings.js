// Key/value settings stored in the singleton `settings` table.
// In-memory cache so callers don't pay a round-trip per read.
import { query, exec } from "./db.js";

let cache = null;
let loaded = false;

async function load() {
  const rows = await query("SELECT key, value FROM settings");
  cache = {};
  for (const r of rows) cache[r.key] = r.value;
  loaded = true;
}

export async function getAllSettings() {
  if (!loaded) await load();
  return { ...cache };
}

export async function getSetting(key, fallback = null) {
  if (!loaded) await load();
  return cache[key] != null ? cache[key] : fallback;
}

export async function setSetting(key, value) {
  if (!loaded) await load();
  const v = value == null ? null : String(value);
  // SQLite UPSERT
  await exec(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, v]
  );
  cache[key] = v;
}

export async function deleteSetting(key) {
  if (!loaded) await load();
  await exec("DELETE FROM settings WHERE key = ?", [key]);
  delete cache[key];
}

// Defaults / known keys.
export const SETTING_KEYS = {
  defaultAccountId: "default_account_id",
  privacyMode: "privacy_mode",
  weekStart: "week_start", // "0" sun | "1" mon
};
