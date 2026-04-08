// Backup management. Auto-backup runs once per day on launch and writes a
// versioned JSON dump to <app_data>/backups/backup-YYYY-MM-DD.json.
//
// All file I/O goes through the Rust commands in src-tauri/src/lib.rs, which
// sandbox paths to the backups directory.
import { invoke } from "@tauri-apps/api/core";
import { dumpDb, restoreDb } from "./export.js";

const KEEP_DAILY = 14;
const AUTO_PREFIX = "backup-"; // auto-backups are backup-YYYY-MM-DD.json
const MANUAL_PREFIX = "manual-"; // user-triggered in-app backups

function todayStamp() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// Returns [{ name, path, size, modified_ms }], newest first.
export async function listBackups() {
  return await invoke("list_backups");
}

// Idempotent: if today's auto-backup already exists, does nothing.
// Returns { created: bool, name, path } or { created: false, reason }.
export async function autoBackup() {
  const stamp = todayStamp();
  const name = `${AUTO_PREFIX}${stamp}.json`;
  const existing = await listBackups();
  if (existing.some((b) => b.name === name)) {
    return { created: false, reason: "already-exists", name };
  }
  const dump = await dumpDb();
  const path = await invoke("write_backup", {
    filename: name,
    contents: JSON.stringify(dump),
  });
  await pruneAutoBackups(KEEP_DAILY);
  return { created: true, name, path };
}

// Manual in-app backup. Always writes a new file with a timestamp suffix.
// Does not count against the auto-backup retention.
export async function manualBackup() {
  const name = `${MANUAL_PREFIX}${nowStamp()}.json`;
  const dump = await dumpDb();
  const path = await invoke("write_backup", {
    filename: name,
    contents: JSON.stringify(dump),
  });
  return { name, path };
}

export async function pruneAutoBackups(keep = KEEP_DAILY) {
  const all = await listBackups();
  const autos = all
    .filter((b) => b.name.startsWith(AUTO_PREFIX))
    .sort((a, b) => b.modified_ms - a.modified_ms);
  const toDelete = autos.slice(keep);
  for (const b of toDelete) {
    try {
      await invoke("delete_backup", { path: b.path });
    } catch (err) {
      console.error("prune failed for", b.name, err);
    }
  }
  return toDelete.length;
}

export async function restoreFromBackup(backupPath) {
  const contents = await invoke("read_backup", { path: backupPath });
  const dump = JSON.parse(contents);
  await restoreDb(dump);
}

export async function deleteBackup(backupPath) {
  await invoke("delete_backup", { path: backupPath });
}

// Find the newest backup (auto or manual) for the "last backup" display.
export async function lastBackupInfo() {
  const all = await listBackups();
  if (all.length === 0) return null;
  return all[0];
}
