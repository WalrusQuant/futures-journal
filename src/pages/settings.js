import {
  getAllSettings,
  setSetting,
  SETTING_KEYS,
} from "../lib/settings.js";
import { listAccounts } from "../lib/accounts.js";
import { listTrades } from "../lib/trades.js";
import { listPlans } from "../lib/plans.js";
import {
  tradesToCsv,
  plansToCsv,
  dumpDb,
  restoreDb,
  exportTextFile,
  importTextFile,
  BACKUP_VERSION,
} from "../lib/export.js";
import { setPrivacyMode } from "../lib/format.js";
import { refreshPage } from "../main.js";
import { esc } from "../lib/format.js";

export async function render() {
  const settings = await getAllSettings();
  const accounts = await listAccounts({ includeArchived: false });

  const defaultAcctId = settings[SETTING_KEYS.defaultAccountId];
  const privacy = settings[SETTING_KEYS.privacyMode] === "1";
  const weekStart = settings[SETTING_KEYS.weekStart] || "0";

  const accountOpts = `<option value="">— first active account —</option>${accounts
    .map(
      (a) =>
        `<option value="${a.id}"${
          String(defaultAcctId || "") === String(a.id) ? " selected" : ""
        }>${esc(a.name)}</option>`
    )
    .join("")}`;

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Configuration</div>
        <h1>Settings</h1>
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:var(--sp-3)">Preferences</h3>
      <form id="prefs-form">
        <div class="form-grid">
          <div class="form-row">
            <label>Default account</label>
            <select name="default_account_id">${accountOpts}</select>
            <div class="help">Used as the initial account for new trades and plans.</div>
          </div>
          <div class="form-row">
            <label>Week starts on</label>
            <select name="week_start">
              <option value="0"${weekStart === "0" ? " selected" : ""}>Sunday</option>
              <option value="1"${weekStart === "1" ? " selected" : ""}>Monday</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Privacy mode</label>
          <label style="display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-md);text-transform:none;letter-spacing:normal;color:var(--text)">
            <input type="checkbox" name="privacy_mode" ${privacy ? "checked" : ""}>
            Hide dollar amounts everywhere (good for screenshots)
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="primary">Save preferences</button>
        </div>
      </form>
    </div>

    <div class="card section">
      <h3 style="margin-bottom:var(--sp-3)">Data</h3>
      <p class="muted" style="margin-bottom:var(--sp-3)">
        Export your journal to CSV for spreadsheets, or to JSON for full backup
        and restore between machines.
      </p>
      <div class="row-actions" style="flex-wrap:wrap;gap:var(--sp-2)">
        <button id="btn-export-trades">Export trades CSV</button>
        <button id="btn-export-plans">Export plans CSV</button>
        <button id="btn-export-json" class="primary">Backup to JSON</button>
        <button id="btn-import-json" class="btn-danger">Restore from JSON…</button>
      </div>
      <div id="export-status" class="help" style="margin-top:var(--sp-3);min-height:1em"></div>
    </div>

    <div class="card section">
      <h3 style="margin-bottom:var(--sp-3)">Diagnostics</h3>
      <dl class="kv">
        <dt>Database</dt>
        <dd class="dim">~/Library/Application Support/com.adamwickwire.futuresjournal/futures-journal.db</dd>
        <dt>Images</dt>
        <dd class="dim">~/Library/Application Support/com.adamwickwire.futuresjournal/images/</dd>
        <dt>Backup format version</dt>
        <dd>${BACKUP_VERSION}</dd>
        <dt>App</dt>
        <dd>Futures Journal v0.1 (opinionated)</dd>
      </dl>
    </div>
  `;

  function mount(pageEl) {
    const prefsForm = pageEl.querySelector("#prefs-form");
    const status = pageEl.querySelector("#export-status");

    prefsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(prefsForm);
      const accountId = fd.get("default_account_id") || null;
      const ws = fd.get("week_start") || "0";
      const privacyOn = fd.get("privacy_mode") === "on";
      await setSetting(SETTING_KEYS.defaultAccountId, accountId);
      await setSetting(SETTING_KEYS.weekStart, ws);
      await setSetting(SETTING_KEYS.privacyMode, privacyOn ? "1" : "0");
      setPrivacyMode(privacyOn);
      status.textContent = "Saved.";
      setTimeout(() => refreshPage(), 300);
    });

    pageEl
      .querySelector("#btn-export-trades")
      .addEventListener("click", async () => {
        try {
          status.textContent = "Building…";
          const trades = await listTrades({});
          const csv = tradesToCsv(trades);
          const path = await exportTextFile({
            filename: `trades-${dateStamp()}.csv`,
            contents: csv,
            filters: [{ name: "CSV", extensions: ["csv"] }],
          });
          status.textContent = path ? `Wrote ${trades.length} trades to ${path}` : "Cancelled.";
        } catch (err) {
          console.error(err);
          status.textContent = "Failed: " + (err.message || err);
        }
      });

    pageEl
      .querySelector("#btn-export-plans")
      .addEventListener("click", async () => {
        try {
          status.textContent = "Building…";
          const plans = await listPlans({ status: "all" });
          const csv = plansToCsv(plans);
          const path = await exportTextFile({
            filename: `plans-${dateStamp()}.csv`,
            contents: csv,
            filters: [{ name: "CSV", extensions: ["csv"] }],
          });
          status.textContent = path ? `Wrote ${plans.length} plans to ${path}` : "Cancelled.";
        } catch (err) {
          console.error(err);
          status.textContent = "Failed: " + (err.message || err);
        }
      });

    pageEl
      .querySelector("#btn-export-json")
      .addEventListener("click", async () => {
        try {
          status.textContent = "Dumping database…";
          const dump = await dumpDb();
          const path = await exportTextFile({
            filename: `futures-journal-backup-${dateStamp()}.json`,
            contents: JSON.stringify(dump, null, 2),
            filters: [{ name: "JSON", extensions: ["json"] }],
          });
          status.textContent = path ? `Backup written to ${path}` : "Cancelled.";
        } catch (err) {
          console.error(err);
          status.textContent = "Failed: " + (err.message || err);
        }
      });

    pageEl
      .querySelector("#btn-import-json")
      .addEventListener("click", async () => {
        const ok = confirm(
          "Restore will WIPE all existing accounts, trades, plans, tags, and settings, " +
            "then load the backup. This cannot be undone.\n\n" +
            "Continue?"
        );
        if (!ok) return;
        try {
          status.textContent = "Reading backup…";
          const file = await importTextFile({
            filters: [{ name: "JSON", extensions: ["json"] }],
          });
          if (!file) {
            status.textContent = "Cancelled.";
            return;
          }
          const dump = JSON.parse(file.contents);
          await restoreDb(dump);
          status.textContent = "Restore complete. Reloading…";
          setTimeout(() => location.reload(), 500);
        } catch (err) {
          console.error(err);
          status.textContent = "Restore failed: " + (err.message || err);
        }
      });
  }

  return { html, mount };
}

function dateStamp() {
  const d = new Date();
  return (
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}
