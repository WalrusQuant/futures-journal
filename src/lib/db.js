// Thin wrapper over @tauri-apps/plugin-sql.
// All DB access in the app goes through this module so we can swap or instrument later.
import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:futures-journal.db";

let _db = null;

export async function getDb() {
  if (_db) return _db;
  _db = await Database.load(DB_URL);
  return _db;
}

export async function query(sql, params = []) {
  const db = await getDb();
  return db.select(sql, params);
}

export async function exec(sql, params = []) {
  const db = await getDb();
  return db.execute(sql, params);
}
