import {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  listTransactions,
  addTransaction,
  deleteTransaction,
  computeHeadroom,
  PROP_FIRMS,
  BROKERS,
  TX_TYPES,
} from "../lib/accounts.js";
import { fmtMoney, fmtDate, fmtDateTime, esc } from "../lib/format.js";
import { openModal, closeModal } from "../components/modal.js";
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
  const subtitle = a.type === "funded" ? a.prop_firm || "—" : a.broker || "—";
  return `
    <tr class="clickable" data-id="${a.id}">
      <td><strong>${esc(a.name)}</strong></td>
      <td><span class="badge ${a.type}${
    a.is_active ? "" : " archived"
  }">${a.type}</span></td>
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
  const headroom = computeHeadroom(account);

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs"><a href="#/accounts">← Accounts</a></div>
        <h1>${esc(account.name)}
          <span class="badge ${account.type}${
    account.is_active ? "" : " archived"
  }" style="margin-left:8px;vertical-align:middle">${account.type}</span>
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
              <div class="stat-label">Trailing DD room</div>
              <div class="stat-value ${
                headroom.trailingRoom < 500 ? "loss" : ""
              }">${fmtMoney(headroom.trailingRoom)}</div>
              <div class="stat-sub">drawdown ${fmtMoney(
                account.trailing_dd
              )}</div>
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
    </div>

    ${
      account.type === "funded"
        ? `<div class="section">
            <div class="section-header"><h2>Rules</h2></div>
            <div class="card">
              <dl class="kv">
                <dt>Trailing drawdown</dt><dd>${
                  account.trailing_dd != null
                    ? fmtMoney(account.trailing_dd)
                    : "—"
                }</dd>
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
                <dt>Max contracts</dt><dd>${account.max_contracts ?? "—"}</dd>
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
        <button id="btn-new-tx">+ Add transaction</button>
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
                      return `
                        <tr>
                          <td>${fmtDate(t.occurred_at)}</td>
                          <td><span class="badge ${t.type}">${t.type}</span></td>
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
        if (!confirm(`Archive ${account.name}?`)) return;
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
    pageEl.querySelectorAll("[data-tx-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this transaction?")) return;
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
    name: "",
    account_size: "",
    current_balance: "",
    broker: "",
    prop_firm: PROP_FIRMS[0],
    trailing_dd: "",
    daily_loss_limit: "",
    profit_target: "",
    max_contracts: "",
    rules_notes: "",
  };

  const wrap = document.createElement("div");
  wrap.innerHTML = accountFormHtml(initial, isEdit);
  const form = wrap.querySelector("form");
  const errEl = wrap.querySelector(".form-error");

  // Toggle funded vs cash sections.
  form.dataset.accountType = initial.type;
  form.querySelectorAll('input[name="type"]').forEach((r) => {
    r.addEventListener("change", () => {
      form.dataset.accountType = r.value;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const fd = new FormData(form);
    const data = {
      name: (fd.get("name") || "").trim(),
      type: fd.get("type"),
      broker: (fd.get("broker") || "").trim() || null,
      prop_firm:
        fd.get("type") === "funded" ? fd.get("prop_firm") || null : null,
      account_size: Number(fd.get("account_size")),
      current_balance: fd.get("current_balance")
        ? Number(fd.get("current_balance"))
        : Number(fd.get("account_size")),
    };
    if (data.type === "funded") {
      data.trailing_dd = numOrNull(fd.get("trailing_dd"));
      data.daily_loss_limit = numOrNull(fd.get("daily_loss_limit"));
      data.profit_target = numOrNull(fd.get("profit_target"));
      data.max_contracts = intOrNull(fd.get("max_contracts"));
      data.rules_notes = (fd.get("rules_notes") || "").trim() || null;
    } else {
      data.trailing_dd = null;
      data.daily_loss_limit = null;
      data.profit_target = null;
      data.max_contracts = null;
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

  return `
    <form id="account-form" autocomplete="off">
      ${
        isEdit
          ? ""
          : `<div class="form-row">
              <label class="form-label">Type</label>
              <div class="radio-group">
                <label><input type="radio" name="type" value="funded" ${
                  a.type === "funded" ? "checked" : ""
                }> Funded prop</label>
                <label><input type="radio" name="type" value="cash" ${
                  a.type === "cash" ? "checked" : ""
                }> Cash brokerage</label>
              </div>
            </div>`
      }
      ${
        isEdit
          ? `<input type="hidden" name="type" value="${a.type}">`
          : ""
      }

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

      <div data-show-when="cash">
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
        <div class="form-grid">
          <div class="form-row">
            <label>Trailing drawdown ($)</label>
            <input name="trailing_dd" type="number" step="0.01" min="0" value="${
              a.trailing_dd ?? ""
            }">
          </div>
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
            <label>Max contracts</label>
            <input name="max_contracts" type="number" step="1" min="0" value="${
              a.max_contracts ?? ""
            }">
          </div>
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

function openTransactionModal(accountId) {
  const today = new Date().toISOString().slice(0, 10);
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <form id="tx-form" autocomplete="off">
      <div class="form-row">
        <label>Type</label>
        <select name="type">
          ${TX_TYPES.map(
            (t) => `<option value="${t.value}">${t.label}</option>`
          ).join("")}
        </select>
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
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      errEl.textContent = "Amount must be a positive number.";
      return;
    }
    try {
      await addTransaction(accountId, {
        type: fd.get("type"),
        amount,
        occurred_at: new Date(fd.get("occurred_at")).toISOString(),
        note: (fd.get("note") || "").trim() || null,
      });
      closeModal();
      refreshPage();
    } catch (err) {
      console.error(err);
      errEl.textContent = String(err.message || err);
    }
  });
  wrap
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", closeModal);

  openModal({ title: "New transaction", body: wrap, width: 480 });
}

// ---------- helpers ----------

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v) {
  const n = numOrNull(v);
  return n == null ? null : Math.trunc(n);
}
