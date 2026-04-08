// Export and backup helpers.
//
// CSV export uses the trade row shape from listTrades (already joined).
// JSON backup is a versioned dump of every table; restore wipes and reloads.
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { query, exec } from "./db.js";

export const BACKUP_VERSION = 1;

const BACKUP_TABLES = [
  "accounts",
  "tags",
  "instruments",
  "trades",
  "plans",
  "trade_tags",
  "plan_tags",
  "trade_images",
  "transactions",
  "settings",
];

// ---------- CSV ----------

export function tradesToCsv(trades) {
  const headers = [
    "id",
    "account",
    "instrument",
    "direction",
    "entry_time",
    "entry_price",
    "stop_price",
    "target_price",
    "exit_time",
    "exit_price",
    "contracts",
    "fees",
    "pnl_points",
    "pnl_dollars",
    "r_multiple",
    "status",
    "confidence",
    "tags",
    "notes",
  ];
  const rows = trades.map((t) => [
    t.id,
    t.account_name || "",
    t.instrument,
    t.direction,
    t.entry_time,
    t.entry_price,
    t.stop_price,
    t.target_price ?? "",
    t.exit_time ?? "",
    t.exit_price ?? "",
    t.contracts,
    t.fees ?? 0,
    t.pnl_points ?? "",
    t.pnl_dollars ?? "",
    t.r_multiple ?? "",
    t.status,
    t.confidence ?? "",
    t.tag_names ? t.tag_names.replace(/\|/g, ",") : "",
    (t.notes || "").replace(/[\r\n]+/g, " "),
  ]);
  return toCsv(headers, rows);
}

export function plansToCsv(plans) {
  const headers = [
    "id",
    "account",
    "instrument",
    "direction",
    "entry_price",
    "stop_price",
    "target_price",
    "contracts",
    "rr_planned",
    "status",
    "trade_id",
    "tags",
    "thesis",
    "created_at",
  ];
  const rows = plans.map((p) => [
    p.id,
    p.account_name || "",
    p.instrument,
    p.direction,
    p.entry_price,
    p.stop_price,
    p.target_price,
    p.contracts,
    p.rr_planned ?? "",
    p.status,
    p.trade_id ?? "",
    p.tag_names ? p.tag_names.replace(/\|/g, ",") : "",
    (p.thesis || "").replace(/[\r\n]+/g, " "),
    p.created_at,
  ]);
  return toCsv(headers, rows);
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ---------- JSON backup ----------

export async function dumpDb() {
  const dump = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
  };
  for (const t of BACKUP_TABLES) {
    dump[t] = await query(`SELECT * FROM ${t}`);
  }
  return dump;
}

export async function restoreDb(dump) {
  if (!dump || dump.version !== BACKUP_VERSION) {
    throw new Error(
      `Backup version mismatch (file=${dump?.version}, expected=${BACKUP_VERSION})`
    );
  }

  // Wipe in dependency order. instruments stays — it's seeded by migration.
  const wipeOrder = [
    "trade_images",
    "trade_tags",
    "plan_tags",
    "transactions",
    "trades",
    "plans",
    "tags",
    "settings",
    "accounts",
  ];

  // Insert in dependency order.
  const insertOrder = [
    "accounts",
    "tags",
    "trades",
    "plans",
    "trade_tags",
    "plan_tags",
    "trade_images",
    "transactions",
    "settings",
  ];

  // Wrap the whole wipe+insert in a transaction. If anything throws
  // mid-restore (bad row shape, constraint violation, disk full, crash),
  // the rollback leaves the existing data untouched. Without this, a
  // failure after the DELETE loop would wipe the user's entire journal.
  await exec("BEGIN");
  try {
    for (const t of wipeOrder) {
      await exec(`DELETE FROM ${t}`);
    }
    for (const t of insertOrder) {
      const rows = dump[t] || [];
      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => "?").join(", ");
        const values = cols.map((c) => row[c]);
        await exec(
          `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${placeholders})`,
          values
        );
      }
    }
    await exec("COMMIT");
  } catch (err) {
    try {
      await exec("ROLLBACK");
    } catch (rollbackErr) {
      // If rollback itself fails, log it but surface the original error.
      console.error("restore rollback failed:", rollbackErr);
    }
    throw err;
  }
}

// ---------- File system bridges ----------

export async function exportTextFile({ filename, contents, filters }) {
  const path = await saveDialog({
    defaultPath: filename,
    filters: filters || [{ name: "All", extensions: ["*"] }],
  });
  if (!path) return null;
  await invoke("write_text_file", { path, contents });
  return path;
}

export async function importTextFile({ filters }) {
  const path = await openDialog({
    multiple: false,
    filters: filters || [{ name: "All", extensions: ["*"] }],
  });
  if (!path) return null;
  const contents = await invoke("read_text_file", { path });
  return { path, contents };
}
