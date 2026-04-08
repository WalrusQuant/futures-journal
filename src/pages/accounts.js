import {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  listTransactions,
  addTransaction,
  createTransfer,
  deleteTransaction,
  computeHeadroom,
  loadAccountRiskContext,
  DRAWDOWN_MODES,
  ACCOUNT_CATEGORIES,
  categoryDef,
  PROP_FIRMS,
  BROKERS,
  TX_TYPES,
  MANUAL_TX_TYPES,
} from "../lib/accounts.js";
import { consistencyStatus } from "../lib/analytics.js";
import { fmtMoney, fmtDate, fmtDateTime, esc } from "../lib/format.js";
import { openModal, closeModal, confirmDialog, notify } from "../components/modal.js";
import { refreshPage } from "../main.js";

// ---------- LIST ----------

export async function renderList() {
  const all = await listAccounts({ includeArchived: true });
  const active = all.filter((a) => a.is_active);
  const archived = all.filter((a) => !a.is_active);

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Capital</div>
        <h1>Accounts</h1>
      </div>
      <button class="primary" id="btn-new-account">+ New account</button>
    </div>

    ${
      active.length === 0
        ? `<div class="card empty-state">
            <h3>No accounts yet</h3>
            <p>Add your first funded prop or cash brokerage account to start logging trades.</p>
          </div>`
        : `<div class="card" style="padding:0">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Broker / Firm</th>
                  <th style="text-align:right">Size</th>
                  <th style="text-align:right">Balance</th>
                  <th style="text-align:right">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                ${active.map(rowHtml).join("")}
              </tbody>
            </table>
          </div>`
    }

    ${
      archived.length
        ? `<div class="section">
            <div class="section-header"><h2>Archived</h2></div>
            <div class="card" style="padding:0">
              <table>
                <tbody>${archived.map(rowHtml).join("")}</tbody>
              </table>
            </div>
          </div>`
        : ""
    }
  `;

  function mount(pageEl) {
    pageEl
      .querySelector("#btn-new-account")
      ?.addEventListener("click", () => openAccountModal());
    pageEl.querySelectorAll("tr.clickable").forEach((tr) => {
      tr.addEventListener("click", () => {
        location.hash = `#/accounts/${tr.dataset.id}`;
      });
    });
  }

  return { html, mount };
}

function rowHtml(a) {
  const pnl = a.current_balance - a.account_size;
  const pnlClass = pnl > 0 ? "profit" : pnl < 0 ? "loss" : "muted";
  const catDef = categoryDef(a.category);
  const catLabel = catDef?.label || a.type;
  const subtitle = a.type === "funded" ? a.prop_firm || "—" : a.broker || "—";
  return `
    <tr class="clickable" data-id="${a.id}">
      <td><strong>${esc(a.name)}</strong></td>
      <td><span class="badge ${a.type}${
    a.is_active ? "" : " archived"
  }">${esc(catLabel)}</span></td>
      <td class="muted">${esc(subtitle)}</td>
      <td style="text-align:right">${fmtMoney(a.account_size)}</td>
      <td style="text-align:right"><strong>${fmtMoney(
        a.current_balance
      )}</strong></td>
      <td style="text-align:right" class="${pnlClass}">${fmtMoney(pnl, {
    signed: true,
  })}</td>
    </tr>
  `;
}

// ---------- DETAIL ----------

export async function renderDetail({ id }) {
  const account = await getAccount(id);
  if (!account) {
    return {
      html: `
        <div class="page-header"><h1>Account not found</h1></div>
        <div class="card"><p class="muted">No account with id ${esc(
          id
        )}. <a href="#/accounts">Back to accounts</a></p></div>
      `,
    };
  }

  const txs = await listTransactions(id);
  const pnl = account.current_balance - account.account_size;
  const pnlClass = pnl > 0 ? "profit" : pnl < 0 ? "loss" : "";
  // Trailing drawdown modes need the account's closed trades + transactions
  // to compute the peak. Load via the batched helper (two queries total)
  // and pass the slice for this one account into computeHeadroom.
  const riskCtx = await loadAccountRiskContext([account]);
  const { trades: ddTrades, transactions: ddTx } = riskCtx.get(account.id) || {
    trades: [],
    transactions: [],
  };
  const headroom = computeHeadroom(account, {
    trades: ddTrades,
    transactions: ddTx,
  });
  const drawdownMode = account.drawdown_mode || "static";
  const drawdownModeDef = DRAWDOWN_MODES.find((m) => m.value === drawdownMode);
  // Consistency rule status: null if not configured or no profitable days yet.
  const consistency = consistencyStatus(ddTrades, account.consistency_pct);
  const catDef = categoryDef(account.category);
  const categoryLabel = catDef?.label || account.type;

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs"><a href="#/accounts">← Accounts</a></div>
        <h1>${esc(account.name)}
          <span class="badge ${account.type}${
    account.is_active ? "" : " archived"
  }" style="margin-left:8px;vertical-align:middle">${esc(categoryLabel)}</span>
        </h1>
        <div class="muted" style="margin-top:4px">
          ${esc(
            account.type === "funded"
              ? account.prop_firm || "—"
              : account.broker || "—"
          )}
          · created ${fmtDate(account.created_at)}
        </div>
      </div>
      <div class="row-actions">
        <button id="btn-edit-account">Edit</button>
        ${
          account.is_active
            ? `<button class="btn-danger" id="btn-archive-account">Archive</button>`
            : `<button id="btn-unarchive-account">Unarchive</button>`
        }
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Starting size</div>
        <div class="stat-value">${fmtMoney(account.account_size)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Current balance</div>
        <div class="stat-value">${fmtMoney(account.current_balance)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">P&amp;L</div>
        <div class="stat-value ${pnlClass}">${fmtMoney(pnl, {
    signed: true,
  })}</div>
      </div>
      ${
        account.type === "funded" && headroom.trailingRoom != null
          ? `<div class="stat">
              <div class="stat-label">DD room (${esc(
                drawdownModeDef?.label || drawdownMode
              )})</div>
              <div class="stat-value ${
                headroom.trailingRoom < 500 ? "loss" : ""
              }">${fmtMoney(headroom.trailingRoom)}</div>
              <div class="stat-sub">drawdown ${fmtMoney(
                account.trailing_dd
              )}${
              headroom.drawdown && headroom.drawdown.mode !== "static"
                ? ` · peak ${fmtMoney(headroom.drawdown.peak)}${
                    headroom.drawdown.locked ? " · locked" : ""
                  }`
                : ""
            }</div>
            </div>`
          : ""
      }
      ${
        account.type === "funded" && headroom.profitToTarget != null
          ? `<div class="stat">
              <div class="stat-label">To profit target</div>
              <div class="stat-value">${fmtMoney(
                headroom.profitToTarget
              )}</div>
              <div class="stat-sub">target ${fmtMoney(
                account.profit_target
              )}</div>
            </div>`
          : ""
      }
      ${
        account.type === "funded" && account.consistency_pct != null
          ? renderConsistencyStat(account, consistency)
          : ""
      }
    </div>

    ${
      account.type === "funded"
        ? `<div class="section">
            <div class="section-header"><h2>Rules</h2></div>
            <div class="card">
              <dl class="kv">
                <dt>Category</dt><dd>${esc(categoryLabel)}</dd>
                <dt>Drawdown type</dt><dd>${esc(
                  drawdownModeDef?.label || drawdownMode
                )}</dd>
                <dt>Drawdown amount</dt><dd>${
                  account.trailing_dd != null
                    ? fmtMoney(account.trailing_dd)
                    : "—"
                }</dd>
                <dt>Lock rule</dt><dd>${esc(
                  lockRuleLabel(account)
                )}</dd>
                <dt>Daily loss limit</dt><dd>${
                  account.daily_loss_limit != null
                    ? fmtMoney(account.daily_loss_limit)
                    : "—"
                }</dd>
                <dt>Profit target</dt><dd>${
                  account.profit_target != null
                    ? fmtMoney(account.profit_target)
                    : "—"
                }</dd>
                <dt>Max minis</dt><dd>${account.max_minis ?? "—"}</dd>
                <dt>Max micros</dt><dd>${account.max_micros ?? "—"}</dd>
                <dt>Consistency limit</dt><dd>${
                  account.consistency_pct != null
                    ? `${account.consistency_pct}%`
                    : "—"
                }</dd>
              </dl>
              ${
                account.rules_notes
                  ? `<div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border)">
                      <div class="form-label" style="margin-bottom:var(--sp-2)">Notes</div>
                      <div style="white-space:pre-wrap">${esc(
                        account.rules_notes
                      )}</div>
                    </div>`
                  : ""
              }
            </div>
          </div>`
        : ""
    }

    <div class="section">
      <div class="section-header">
        <h2>Transactions</h2>
        <div class="row-actions">
          <button id="btn-new-tx">+ Add transaction</button>
          <button id="btn-new-transfer">Transfer</button>
        </div>
      </div>
      ${
        txs.length === 0
          ? `<div class="card empty-state"><p>No transactions yet.</p></div>`
          : `<div class="card" style="padding:0">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th style="text-align:right">Amount</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${txs
                    .map((t) => {
                      const def = TX_TYPES.find((x) => x.value === t.type);
                      const sign = def ? def.sign : -1;
                      const display = sign * t.amount;
                      const label = def?.label || t.type;
                      return `
                        <tr>
                          <td>${fmtDate(t.occurred_at)}</td>
                          <td><span class="badge ${t.type}">${esc(label)}</span></td>
                          <td style="text-align:right" class="${
                            sign > 0 ? "profit" : "loss"
                          }">${fmtMoney(display, { signed: true })}</td>
                          <td class="muted">${esc(t.note || "")}</td>
                          <td style="text-align:right">
                            <button class="btn-link btn-danger" data-tx-del="${
                              t.id
                            }">delete</button>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>`
      }
    </div>
  `;

  function mount(pageEl) {
    pageEl
      .querySelector("#btn-edit-account")
      ?.addEventListener("click", () => openAccountModal(account));
    pageEl
      .querySelector("#btn-archive-account")
      ?.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: "Archive account",
          message: `Archive ${account.name}?\n\nIt will be hidden from the active list but its trades and history will be preserved.`,
          confirmLabel: "Archive",
        });
        if (!ok) return;
        await archiveAccount(account.id);
        refreshPage();
      });
    pageEl
      .querySelector("#btn-unarchive-account")
      ?.addEventListener("click", async () => {
        await unarchiveAccount(account.id);
        refreshPage();
      });
    pageEl
      .querySelector("#btn-new-tx")
      ?.addEventListener("click", () => openTransactionModal(account.id));
    pageEl
      .querySelector("#btn-new-transfer")
      ?.addEventListener("click", () => openTransferModal(account.id));
    pageEl.querySelectorAll("[data-tx-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: "Delete transaction",
          message: "Delete this transaction? The account balance will be recalculated.",
          confirmLabel: "Delete",
          danger: true,
        });
        if (!ok) return;
        await deleteTransaction(Number(btn.dataset.txDel));
        refreshPage();
      });
    });
  }

  return { html, mount };
}

// ---------- ACCOUNT FORM (modal) ----------

function openAccountModal(account = null) {
  const isEdit = !!account;
  const initial = account || {
    type: "funded",
    category: "sim_funded",
    name: "",
    account_size: "",
    current_balance: "",
    broker: "",
    prop_firm: PROP_FIRMS[0],
    trailing_dd: "",
    daily_loss_limit: "",
    profit_target: "",
    max_minis: "",
    max_micros: "",
    drawdown_mode: "static",
    dd_lock_offset: "",
    dd_lock_on_payout: 0,
    consistency_pct: "",
    rules_notes: "",
  };
  // Normalize legacy accounts that predate the category column.
  if (!initial.category) {
    initial.category = initial.type === "cash" ? "cash" : "sim_funded";
  }

  const wrap = document.createElement("div");
  wrap.innerHTML = accountFormHtml(initial, isEdit);
  const form = wrap.querySelector("form");
  const errEl = wrap.querySelector(".form-error");

  // Category drives the funded-vs-cash section toggle and the derived
  // rule engine `type`. Update both on change.
  const categorySelect = form.querySelector("#account-category-select");
  const categoryHelp = form.querySelector("#account-category-help");
  const applyCategory = (value) => {
    const def = categoryDef(value);
    const t = def?.type || "cash";
    form.dataset.accountType = t;
    form.dataset.accountCategory = value;
    if (categoryHelp) categoryHelp.textContent = def?.desc || "";
  };
  applyCategory(initial.category);
  categorySelect?.addEventListener("change", () => {
    applyCategory(categorySelect.value);
  });

  // Drawdown mode help text updates live.
  const modeSelect = form.querySelector("#drawdown-mode-select");
  const modeHelp = form.querySelector("#drawdown-mode-help");
  if (modeSelect && modeHelp) {
    modeSelect.addEventListener("change", () => {
      const def = DRAWDOWN_MODES.find((m) => m.value === modeSelect.value);
      modeHelp.textContent = def?.desc || "";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const fd = new FormData(form);
    const category = fd.get("category") || "sim_funded";
    const derivedType = categoryDef(category)?.type || "cash";
    const data = {
      name: (fd.get("name") || "").trim(),
      category,
      type: derivedType,
      broker: (fd.get("broker") || "").trim() || null,
      prop_firm:
        derivedType === "funded" ? fd.get("prop_firm") || null : null,
      account_size: Number(fd.get("account_size")),
      current_balance: fd.get("current_balance")
        ? Number(fd.get("current_balance"))
        : Number(fd.get("account_size")),
    };
    if (data.type === "funded") {
      data.trailing_dd = numOrNull(fd.get("trailing_dd"));
      data.daily_loss_limit = numOrNull(fd.get("daily_loss_limit"));
      data.profit_target = numOrNull(fd.get("profit_target"));
      data.max_minis = intOrNull(fd.get("max_minis"));
      data.max_micros = intOrNull(fd.get("max_micros"));
      data.drawdown_mode = fd.get("drawdown_mode") || "static";
      data.dd_lock_offset = numOrNull(fd.get("dd_lock_offset"));
      data.dd_lock_on_payout = fd.get("dd_lock_on_payout") ? 1 : 0;
      data.consistency_pct = numOrNull(fd.get("consistency_pct"));
      data.rules_notes = (fd.get("rules_notes") || "").trim() || null;
    } else {
      data.trailing_dd = null;
      data.daily_loss_limit = null;
      data.profit_target = null;
      data.max_minis = null;
      data.max_micros = null;
      data.drawdown_mode = "none";
      data.dd_lock_offset = null;
      data.dd_lock_on_payout = 0;
      data.consistency_pct = null;
      data.rules_notes = null;
    }

    if (!data.name) {
      errEl.textContent = "Name is required.";
      return;
    }
    if (!Number.isFinite(data.account_size) || data.account_size <= 0) {
      errEl.textContent = "Account size must be a positive number.";
      return;
    }
    if (
      data.dd_lock_offset != null &&
      (!Number.isFinite(data.dd_lock_offset) || data.dd_lock_offset < 0)
    ) {
      errEl.textContent = "Lock offset must be zero or a positive number.";
      return;
    }
    if (
      data.consistency_pct != null &&
      (!Number.isFinite(data.consistency_pct) ||
        data.consistency_pct < 0 ||
        data.consistency_pct > 100)
    ) {
      errEl.textContent = "Consistency limit must be between 0 and 100.";
      return;
    }
    if (
      data.trailing_dd != null &&
      (!Number.isFinite(data.trailing_dd) || data.trailing_dd < 0)
    ) {
      errEl.textContent = "Trailing drawdown must be zero or a positive number.";
      return;
    }
    if (
      data.daily_loss_limit != null &&
      (!Number.isFinite(data.daily_loss_limit) || data.daily_loss_limit < 0)
    ) {
      errEl.textContent = "Daily loss limit must be zero or a positive number.";
      return;
    }
    if (
      data.profit_target != null &&
      (!Number.isFinite(data.profit_target) || data.profit_target < 0)
    ) {
      errEl.textContent = "Profit target must be zero or a positive number.";
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (isEdit) {
        await updateAccount(account.id, data);
      } else {
        await createAccount(data);
      }
      closeModal();
      refreshPage();
    } catch (err) {
      console.error(err);
      errEl.textContent = String(err.message || err);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  wrap
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", closeModal);

  openModal({
    title: isEdit ? "Edit account" : "New account",
    body: wrap,
    width: 580,
  });
}

function accountFormHtml(a, isEdit) {
  const propOptions = PROP_FIRMS.map(
    (f) =>
      `<option value="${esc(f)}"${a.prop_firm === f ? " selected" : ""}>${esc(
        f
      )}</option>`
  ).join("");
  const brokerOptions = BROKERS.map(
    (b) =>
      `<option value="${esc(b)}"${a.broker === b ? " selected" : ""}>${esc(
        b
      )}</option>`
  ).join("");

  const currentCategory = a.category || (a.type === "cash" ? "cash" : "sim_funded");
  const categoryOptions = ACCOUNT_CATEGORIES.map(
    (c) =>
      `<option value="${esc(c.value)}"${
        currentCategory === c.value ? " selected" : ""
      }>${esc(c.label)}</option>`
  ).join("");
  const currentCategoryDef = categoryDef(currentCategory);

  return `
    <form id="account-form" autocomplete="off">
      <div class="form-row">
        <label>Category</label>
        <select name="category" id="account-category-select">${categoryOptions}</select>
        <div class="help" id="account-category-help">${esc(
          currentCategoryDef?.desc || ""
        )}</div>
      </div>

      <div class="form-row">
        <label>Name</label>
        <input name="name" required value="${esc(a.name)}" placeholder="Apex 100k #1">
      </div>

      <div data-show-when="funded">
        <div class="form-row">
          <label>Prop firm</label>
          <select name="prop_firm">${propOptions}</select>
        </div>
      </div>

      <div data-show-when="cash-broker">
        <div class="form-row">
          <label>Broker</label>
          <select name="broker">${brokerOptions}</select>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-row">
          <label>Account size ($)</label>
          <input name="account_size" type="number" step="0.01" min="0" required value="${
            a.account_size || ""
          }">
        </div>
        <div class="form-row">
          <label>Current balance ($)</label>
          <input name="current_balance" type="number" step="0.01" value="${
            a.current_balance || ""
          }" placeholder="defaults to size">
        </div>
      </div>

      <div data-show-when="funded">
        <div class="form-row">
          <label>Drawdown type</label>
          <select name="drawdown_mode" id="drawdown-mode-select">
            ${DRAWDOWN_MODES.map(
              (m) =>
                `<option value="${m.value}"${
                  (a.drawdown_mode || "static") === m.value ? " selected" : ""
                }>${esc(m.label)}</option>`
            ).join("")}
          </select>
          <div class="help" id="drawdown-mode-help">${esc(
            DRAWDOWN_MODES.find(
              (m) => m.value === (a.drawdown_mode || "static")
            )?.desc || ""
          )}</div>
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label>Drawdown amount ($)</label>
            <input name="trailing_dd" type="number" step="0.01" min="0" value="${
              a.trailing_dd ?? ""
            }">
          </div>
          <div class="form-row">
            <label>Lock floor at starting + $</label>
            <input name="dd_lock_offset" type="number" step="0.01" min="0" value="${
              a.dd_lock_offset ?? ""
            }" placeholder="leave empty = no lock">
            <div class="help">Combine: <code>0</code>. Sim funded: usually <code>100</code>. Empty means the floor keeps trailing forever.</div>
          </div>
        </div>
        <div class="form-row">
          <label>
            <input type="checkbox" name="dd_lock_on_payout" value="1"${
              a.dd_lock_on_payout ? " checked" : ""
            }>
            Also lock on any withdrawal or payout
          </label>
          <div class="help">Sim-funded accounts typically freeze the trailing floor the moment you take a withdrawal or payout, regardless of whether the peak threshold has been reached.</div>
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label>Daily loss limit ($)</label>
            <input name="daily_loss_limit" type="number" step="0.01" min="0" value="${
              a.daily_loss_limit ?? ""
            }">
          </div>
          <div class="form-row">
            <label>Profit target ($)</label>
            <input name="profit_target" type="number" step="0.01" min="0" value="${
              a.profit_target ?? ""
            }">
          </div>
          <div class="form-row">
            <label>Max minis</label>
            <input name="max_minis" type="number" step="1" min="0" value="${
              a.max_minis ?? ""
            }" placeholder="e.g. 4">
          </div>
          <div class="form-row">
            <label>Max micros</label>
            <input name="max_micros" type="number" step="1" min="0" value="${
              a.max_micros ?? ""
            }" placeholder="e.g. 40">
          </div>
        </div>
        <div class="form-row">
          <label>Consistency limit (%)</label>
          <input name="consistency_pct" type="number" step="1" min="0" max="100" value="${
            a.consistency_pct ?? ""
          }" placeholder="e.g. 30">
          <div class="help">Best day's profit must stay under this % of total profit. Evaluated end-of-day, display only. Leave empty to disable.</div>
        </div>
        <div class="form-row">
          <label>Rules notes</label>
          <textarea name="rules_notes" placeholder="Consistency rule, news restrictions, scaling plan...">${esc(
            a.rules_notes || ""
          )}</textarea>
          <div class="help">Free-form. The app enforces the numeric rules above; this is for everything else.</div>
        </div>
      </div>

      <div class="form-error"></div>
      <div class="form-actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="submit" class="primary">${
          isEdit ? "Save changes" : "Create account"
        }</button>
      </div>
    </form>
  `;
}

// ---------- TRANSACTION FORM (modal) ----------

async function openTransactionModal(accountId) {
  const today = new Date().toISOString().slice(0, 10);
  // Load candidate "paid for" funded accounts for fee-type transactions.
  // Active only by default — a failed combine you archived shouldn't
  // show up as a viable target for new fee attribution.
  const allAccounts = await listAccounts({ includeArchived: false });
  const fundedAccounts = allAccounts.filter(
    (a) => categoryDef(a.category)?.type === "funded"
  );
  const paidForOptions =
    `<option value="">(none)</option>` +
    fundedAccounts
      .map(
        (a) =>
          `<option value="${a.id}">${esc(a.name)} — ${esc(
            categoryDef(a.category)?.label || a.type
          )}</option>`
      )
      .join("");

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <form id="tx-form" autocomplete="off">
      <div class="form-row">
        <label>Type</label>
        <select name="type" id="tx-type-select">
          ${MANUAL_TX_TYPES.map(
            (t) => `<option value="${t.value}">${t.label}</option>`
          ).join("")}
        </select>
      </div>
      <div class="form-row" id="tx-paid-for-row" style="display:none">
        <label>Paid for account (optional)</label>
        <select name="paid_for_account_id">${paidForOptions}</select>
        <div class="help">Links this fee to the combine/funded account it pays for so the ledger can show per-account fee burn.</div>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label>Amount ($)</label>
          <input name="amount" type="number" step="0.01" min="0" required>
          <div class="help">Always positive. The type controls the sign.</div>
        </div>
        <div class="form-row">
          <label>Date</label>
          <input name="occurred_at" type="date" value="${today}" required>
        </div>
      </div>
      <div class="form-row">
        <label>Note (optional)</label>
        <input name="note" placeholder="Wire from chase, payout request...">
      </div>
      <div class="form-error"></div>
      <div class="form-actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="submit" class="primary">Add transaction</button>
      </div>
    </form>
  `;

  const form = wrap.querySelector("form");
  const errEl = wrap.querySelector(".form-error");
  const typeSelect = form.querySelector("#tx-type-select");
  const paidForRow = form.querySelector("#tx-paid-for-row");
  // The "paid for account" selector is only relevant for fee-style
  // transactions (subscription fee, reset fee, activation fee).
  const togglePaidFor = () => {
    const t = typeSelect.value;
    const show = t === "fee" || t === "reset" || t === "activation";
    paidForRow.style.display = show ? "" : "none";
  };
  typeSelect.addEventListener("change", togglePaidFor);
  togglePaidFor();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      errEl.textContent = "Amount must be a positive number.";
      return;
    }
    const paidForRaw = fd.get("paid_for_account_id");
    const paidForId =
      paidForRaw && paidForRaw !== "" ? Number(paidForRaw) : null;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await addTransaction(accountId, {
        type: fd.get("type"),
        amount,
        occurred_at: new Date(fd.get("occurred_at")).toISOString(),
        note: (fd.get("note") || "").trim() || null,
        paid_for_account_id: paidForId,
      });
      closeModal();
      refreshPage();
    } catch (err) {
      console.error(err);
      errEl.textContent = String(err.message || err);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
  wrap
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", closeModal);

  openModal({ title: "New transaction", body: wrap, width: 480 });
}

// ---------- TRANSFER FORM (modal) ----------

async function openTransferModal(sourceAccountId) {
  const today = new Date().toISOString().slice(0, 10);
  const allAccounts = await listAccounts({ includeArchived: false });
  const source = allAccounts.find((a) => a.id === sourceAccountId);
  if (!source) return;
  // Destinations: every other active account. Funded categories are
  // still valid destinations — e.g. a transfer *into* a funded account
  // is unusual but could happen if the user recorded a payout backward
  // and wants to reverse it. We don't filter aggressively here.
  const destOptions = allAccounts
    .filter((a) => a.id !== sourceAccountId)
    .map(
      (a) =>
        `<option value="${a.id}">${esc(a.name)} — ${esc(
          categoryDef(a.category)?.label || a.type
        )}</option>`
    )
    .join("");
  if (!destOptions) {
    await notify({
      title: "No destination",
      message:
        "There are no other active accounts to transfer to. Create another account first.",
    });
    return;
  }

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <form id="xfer-form" autocomplete="off">
      <div class="form-row">
        <label>From</label>
        <div><strong>${esc(source.name)}</strong> <span class="dim">(${esc(
    categoryDef(source.category)?.label || source.type
  )})</span></div>
      </div>
      <div class="form-row">
        <label>To</label>
        <select name="to_account_id" required>${destOptions}</select>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label>Amount ($)</label>
          <input name="amount" type="number" step="0.01" min="0" required>
        </div>
        <div class="form-row">
          <label>Date</label>
          <input name="occurred_at" type="date" value="${today}" required>
        </div>
      </div>
      <div class="form-row">
        <label>Note (optional)</label>
        <input name="note" placeholder="Monthly sweep to Schwab...">
      </div>
      <div class="help">Creates two linked ledger entries — a transfer_out on ${esc(
        source.name
      )} and a matching transfer_in on the destination. Deleting either side removes both.</div>
      <div class="form-error"></div>
      <div class="form-actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="submit" class="primary">Transfer</button>
      </div>
    </form>
  `;

  const form = wrap.querySelector("form");
  const errEl = wrap.querySelector(".form-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    const toId = Number(fd.get("to_account_id"));
    if (!Number.isFinite(amount) || amount <= 0) {
      errEl.textContent = "Amount must be a positive number.";
      return;
    }
    if (!Number.isFinite(toId)) {
      errEl.textContent = "Pick a destination account.";
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await createTransfer({
        from_account_id: sourceAccountId,
        to_account_id: toId,
        amount,
        occurred_at: new Date(fd.get("occurred_at")).toISOString(),
        note: (fd.get("note") || "").trim() || null,
      });
      closeModal();
      refreshPage();
    } catch (err) {
      console.error(err);
      errEl.textContent = String(err.message || err);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
  wrap
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", closeModal);

  openModal({ title: "New transfer", body: wrap, width: 480 });
}

// ---------- helpers ----------

// Human-readable description of the account's drawdown lock rule.
function lockRuleLabel(account) {
  if (account.dd_lock_offset == null) return "None";
  const base =
    account.dd_lock_offset === 0
      ? "At starting balance"
      : `At starting + ${fmtMoney(account.dd_lock_offset)}`;
  return account.dd_lock_on_payout ? `${base} · or on withdrawal/payout` : base;
}

// Consistency stat tile for the account detail page. Tone is derived
// from how close the best-day ratio is to the configured limit.
function renderConsistencyStat(account, c) {
  if (!c) {
    return `
      <div class="stat">
        <div class="stat-label">Consistency</div>
        <div class="stat-value dim">—</div>
        <div class="stat-sub">limit ${account.consistency_pct}% · no profitable days yet</div>
      </div>
    `;
  }
  const pct = c.ratio * 100;
  const limitPct = c.limit * 100;
  const tone = c.breach
    ? "loss"
    : limitPct - pct < 5
    ? "warn"
    : "profit";
  return `
    <div class="stat">
      <div class="stat-label">Consistency</div>
      <div class="stat-value ${tone}">${pct.toFixed(0)}%</div>
      <div class="stat-sub">best ${fmtMoney(c.bestDay)} · limit ${limitPct.toFixed(
    0
  )}%</div>
    </div>
  `;
}

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v) {
  const n = numOrNull(v);
  return n == null ? null : Math.trunc(n);
}
