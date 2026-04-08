import {
  listTrades,
  getTrade,
  createTrade,
  updateTrade,
  deleteTrade,
  setReview,
  EMOTIONAL_STATES,
} from "../lib/trades.js";
import { getPlan, setPlanStatus } from "../lib/plans.js";
import { listAccounts } from "../lib/accounts.js";
import { listTags, getTradeTags, setTradeTags } from "../lib/tags.js";
import { mountTagPicker } from "../components/tag-picker.js";
import { mountImageGallery } from "../components/image-gallery.js";
import { confirmDialog, openModal, closeModal } from "../components/modal.js";
import { getSetting, SETTING_KEYS } from "../lib/settings.js";
import {
  listInstruments,
  getInstrument,
  groupByCategory,
  CATEGORY_LABELS,
} from "../lib/instruments.js";
import {
  tradePnL,
  tradeRisk,
  rMultiple,
  plannedRR,
  validateTradeShape,
} from "../lib/calc.js";
import { assessDraft } from "../lib/risk.js";
import {
  fmtMoney,
  fmtNumber,
  fmtDate,
  fmtDateTime,
  esc,
} from "../lib/format.js";
import { refreshPage, registerPageCleanup } from "../main.js";
import { attachSort } from "../lib/table-sort.js";
import { attachValidator } from "../lib/form-validate.js";

// ---------- LIST ----------

export async function renderList() {
  const accounts = await listAccounts({ includeArchived: true });
  const instruments = await listInstruments();
  const filters = readFilters();
  const trades = await listTrades(filters);

  const accountOpts = `<option value="">All accounts</option>${accounts
    .map(
      (a) =>
        `<option value="${a.id}"${
          String(filters.account_id || "") === String(a.id) ? " selected" : ""
        }>${esc(a.name)}</option>`
    )
    .join("")}`;
  const instrumentOpts = `<option value="">All instruments</option>${instruments
    .map(
      (i) =>
        `<option value="${esc(i.symbol)}"${
          filters.instrument === i.symbol ? " selected" : ""
        }>${esc(i.symbol)} — ${esc(i.name)}</option>`
    )
    .join("")}`;
  const statusOpts = ["", "open", "closed"]
    .map(
      (s) =>
        `<option value="${s}"${filters.status === s ? " selected" : ""}>${
          s ? s : "All status"
        }</option>`
    )
    .join("");

  const filterCount = countActiveFilters(filters);
  const filtersActive = filterCount > 0;

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Execution</div>
        <h1>Trades</h1>
      </div>
      <a href="#/trades/new"><button class="primary">+ New trade</button></a>
    </div>

    <div class="filter-summary">${
      filtersActive
        ? `<span class="filter-count">${filterCount}</span> filter${
            filterCount === 1 ? "" : "s"
          } active
           <button type="button" class="clear-filters" id="btn-clear-summary">Clear all</button>`
        : ""
    }</div>

    <form class="filter-bar" id="filter-form">
      <div class="form-row">
        <label>Account</label>
        <select name="account_id">${accountOpts}</select>
      </div>
      <div class="form-row">
        <label>Instrument</label>
        <select name="instrument">${instrumentOpts}</select>
      </div>
      <div class="form-row">
        <label>Status</label>
        <select name="status">${statusOpts}</select>
      </div>
      <div class="form-row">
        <label>From</label>
        <input type="date" name="from" value="${filters.fromDate || ""}">
      </div>
      <div class="form-row">
        <label>To</label>
        <input type="date" name="to" value="${filters.toDate || ""}">
      </div>
      <div class="form-row">
        <label>&nbsp;</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);text-transform:none;letter-spacing:normal;color:var(--text)">
          <input type="checkbox" name="needs_review" value="1" ${
            filters.needsReview ? "checked" : ""
          }>
          Needs review only
        </label>
      </div>
      <div style="display:flex;gap:var(--sp-2)">
        <button type="submit" class="primary btn-sm">Apply</button>
        <button type="button" class="btn-sm" id="btn-clear">Clear</button>
      </div>
    </form>

    ${
      trades.length === 0
        ? `<div class="card empty-state">
            <h3>${
              accounts.length === 0 ? "No accounts yet" : "No trades match"
            }</h3>
            <p>${
              accounts.length === 0
                ? `Add an account first, then come back here.`
                : filtersActive
                ? `No trades match the current filters.`
                : `Log your first trade to start the journal.`
            }</p>
            ${
              filtersActive
                ? `<div class="empty-state-action"><button type="button" class="btn-sm" id="btn-clear-empty">Clear all filters</button></div>`
                : ""
            }
          </div>`
        : `<div class="card" style="padding:0">
            <table id="trades-table">
              <thead>
                <tr>
                  <th class="th-sortable" data-sort-key="entry_time" data-sort-type="date">Date</th>
                  <th class="th-sortable" data-sort-key="account_name" data-sort-type="string">Account</th>
                  <th class="th-sortable" data-sort-key="instrument" data-sort-type="string">Symbol</th>
                  <th class="th-sortable" data-sort-key="direction" data-sort-type="string">Side</th>
                  <th class="num th-sortable" data-sort-key="contracts" data-sort-type="number">Qty</th>
                  <th class="num th-sortable" data-sort-key="entry_price" data-sort-type="number">Entry</th>
                  <th class="num th-sortable" data-sort-key="exit_price" data-sort-type="number">Exit</th>
                  <th class="num th-sortable" data-sort-key="r_multiple" data-sort-type="number">R</th>
                  <th class="num th-sortable" data-sort-key="pnl_dollars" data-sort-type="number">P&amp;L</th>
                  <th class="th-sortable" data-sort-key="status" data-sort-type="string">Status</th>
                </tr>
              </thead>
              <tbody>${trades.map(rowHtml).join("")}</tbody>
            </table>
          </div>`
    }
  `;

  function mount(pageEl) {
    const form = pageEl.querySelector("#filter-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const params = new URLSearchParams();
      for (const k of ["account_id", "instrument", "status", "from", "to"]) {
        const v = fd.get(k);
        if (v) params.set(k, v);
      }
      if (fd.get("needs_review") === "1") params.set("needs_review", "1");
      location.hash = "#/trades" + (params.toString() ? "?" + params : "");
    });
    const clearAll = () => {
      location.hash = "#/trades";
    };
    pageEl.querySelector("#btn-clear").addEventListener("click", clearAll);
    pageEl
      .querySelector("#btn-clear-summary")
      ?.addEventListener("click", clearAll);
    pageEl
      .querySelector("#btn-clear-empty")
      ?.addEventListener("click", clearAll);

    // Sort wiring. Click handlers attach via attachSort(); rows re-render in
    // place. Row click delegation has to be re-bound on each sort because
    // attachSort overwrites tbody innerHTML.
    const tableEl = pageEl.querySelector("#trades-table");
    if (tableEl) {
      const bindRowClicks = () => {
        tableEl.querySelectorAll("tr.clickable").forEach((tr) => {
          tr.addEventListener("click", () => {
            location.hash = `#/trades/${tr.dataset.id}`;
          });
        });
      };
      attachSort(tableEl, {
        rows: trades,
        renderRow: rowHtml,
        onChange: bindRowClicks,
      });
      bindRowClicks();
    }
  }

  return { html, mount };
}

function countActiveFilters(f) {
  let n = 0;
  if (f.account_id) n++;
  if (f.instrument) n++;
  if (f.status) n++;
  if (f.fromDate) n++;
  if (f.toDate) n++;
  if (f.needsReview) n++;
  return n;
}

function readFilters() {
  const hash = location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx < 0) return {};
  const sp = new URLSearchParams(hash.slice(qIdx + 1));
  const out = {};
  if (sp.get("account_id")) out.account_id = Number(sp.get("account_id"));
  if (sp.get("instrument")) out.instrument = sp.get("instrument");
  if (sp.get("status")) out.status = sp.get("status");
  if (sp.get("needs_review") === "1") out.needsReview = true;
  if (sp.get("from")) {
    out.fromDate = sp.get("from");
    out.from = new Date(sp.get("from") + "T00:00:00").toISOString();
  }
  if (sp.get("to")) {
    out.toDate = sp.get("to");
    out.to = new Date(sp.get("to") + "T23:59:59").toISOString();
  }
  return out;
}

function rowHtml(t) {
  const r = t.r_multiple;
  const pnl = t.pnl_dollars;
  const rClass = r == null ? "dim" : r > 0 ? "profit" : r < 0 ? "loss" : "";
  const pnlClass =
    pnl == null ? "dim" : pnl > 0 ? "profit" : pnl < 0 ? "loss" : "";
  return `
    <tr class="clickable" data-id="${t.id}">
      <td>${fmtDateTime(t.entry_time)}</td>
      <td>${esc(t.account_name)}</td>
      <td><strong>${esc(t.instrument)}</strong>
        ${t.tag_names ? `<div class="trade-row-tags">${renderRowTags(t)}</div>` : ""}
      </td>
      <td><span class="badge ${t.direction}">${t.direction}</span></td>
      <td class="num">${t.contracts}</td>
      <td class="num">${fmtNumber(t.entry_price, 4)}</td>
      <td class="num">${
        t.exit_price != null ? fmtNumber(t.exit_price, 4) : "—"
      }</td>
      <td class="num ${rClass}">${
        r != null ? (r > 0 ? "+" : "") + r.toFixed(2) + "R" : "—"
      }</td>
      <td class="num ${pnlClass}">${
        pnl != null ? fmtMoney(pnl, { signed: true }) : "—"
      }</td>
      <td><span class="badge ${t.status}">${t.status}</span></td>
    </tr>
  `;
}

function renderRowTags(t) {
  // tag_names and tag_colors come back from listTrades as joined strings.
  if (!t.tag_names) return "";
  const names = t.tag_names.split("|");
  const colors = (t.tag_colors || "").split("|");
  return names
    .map(
      (n, i) =>
        `<span class="tag-static" style="--tag-color:${esc(
          colors[i] || "#94a3b8"
        )}">${esc(n)}</span>`
    )
    .join("");
}

// ---------- DETAIL ----------

export async function renderDetail({ id }) {
  const trade = await getTrade(id);
  const tradeTags = trade ? await getTradeTags(id) : [];
  if (!trade) {
    return {
      html: `
        <div class="page-header"><h1>Trade not found</h1></div>
        <div class="card"><p class="muted"><a href="#/trades">← Back to trades</a></p></div>
      `,
    };
  }
  const inst = await getInstrument(trade.instrument);
  const risk = tradeRisk(trade, inst);
  const plannedR =
    trade.target_price != null ? plannedRR(trade) : null;

  const pnlClass =
    trade.pnl_dollars == null
      ? ""
      : trade.pnl_dollars > 0
      ? "profit"
      : trade.pnl_dollars < 0
      ? "loss"
      : "";

  const needsReview =
    trade.status === "closed" && !trade.review_completed;

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs"><a href="#/trades">← Trades</a></div>
        <h1>${esc(trade.instrument)}
          <span class="badge ${trade.direction}" style="margin-left:8px;vertical-align:middle">${trade.direction}</span>
          <span class="badge ${trade.status}" style="margin-left:4px;vertical-align:middle">${trade.status}</span>
          ${
            needsReview
              ? `<span class="badge badge-needs-review" style="margin-left:4px;vertical-align:middle">needs review</span>`
              : trade.review_completed
              ? `<span class="badge badge-reviewed" style="margin-left:4px;vertical-align:middle">reviewed</span>`
              : ""
          }
        </h1>
        <div class="muted" style="margin-top:4px">
          ${esc(trade.account_name)} · ${fmtDateTime(trade.entry_time)}
          ${
            trade.plan_id
              ? trade.plan_deleted
                ? ` · <span class="muted">from plan #${trade.plan_id} (deleted)</span>`
                : ` · <a href="#/plans/${trade.plan_id}">from plan #${trade.plan_id}</a>`
              : ""
          }
        </div>
      </div>
      <div class="row-actions">
        <a href="#/trades/${trade.id}/edit"><button>Edit</button></a>
        <button class="btn-danger" id="btn-delete">Delete</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Contracts</div>
        <div class="stat-value">${trade.contracts}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Risk</div>
        <div class="stat-value">${
          risk ? fmtMoney(risk.dollars) : "—"
        }</div>
        <div class="stat-sub">${
          risk ? fmtNumber(risk.points, 2) + " pts" : ""
        }</div>
      </div>
      ${
        trade.r_multiple != null
          ? `<div class="stat">
              <div class="stat-label">R-multiple</div>
              <div class="stat-value ${
                trade.r_multiple > 0 ? "profit" : "loss"
              }">${(trade.r_multiple > 0 ? "+" : "") + trade.r_multiple.toFixed(2)}R</div>
            </div>`
          : plannedR != null
          ? `<div class="stat">
              <div class="stat-label">Planned R:R</div>
              <div class="stat-value">${plannedR.toFixed(2)}</div>
            </div>`
          : ""
      }
      ${
        trade.pnl_dollars != null
          ? `<div class="stat">
              <div class="stat-label">P&amp;L</div>
              <div class="stat-value ${pnlClass}">${fmtMoney(
              trade.pnl_dollars,
              { signed: true }
            )}</div>
              <div class="stat-sub">${
                trade.pnl_points != null
                  ? (trade.pnl_points > 0 ? "+" : "") +
                    trade.pnl_points.toFixed(2) +
                    " pts"
                  : ""
              }</div>
            </div>`
          : ""
      }
    </div>

    <div class="section">
      <div class="card">
        <dl class="kv">
          <dt>Entry</dt>
          <dd>${fmtNumber(trade.entry_price, 4)} @ ${fmtDateTime(
    trade.entry_time
  )}</dd>
          <dt>Stop</dt>
          <dd>${fmtNumber(trade.stop_price, 4)}</dd>
          ${
            trade.target_price != null
              ? `<dt>Target</dt><dd>${fmtNumber(trade.target_price, 4)}</dd>`
              : ""
          }
          ${
            trade.exit_price != null
              ? `<dt>Exit</dt><dd>${fmtNumber(
                  trade.exit_price,
                  4
                )} @ ${fmtDateTime(trade.exit_time)}</dd>`
              : ""
          }
          <dt>Fees</dt><dd>${fmtMoney(trade.fees || 0)}</dd>
          ${
            trade.confidence != null
              ? `<dt>Confidence</dt><dd>${trade.confidence} / 5</dd>`
              : ""
          }
        </dl>
        ${
          tradeTags.length
            ? `<div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border)">
                <div class="form-label" style="margin-bottom:var(--sp-2)">Tags</div>
                <div>${tradeTags
                  .map(
                    (t) =>
                      `<span class="tag-static" style="--tag-color:${esc(
                        t.color
                      )}">${esc(t.name)}</span>`
                  )
                  .join("")}</div>
              </div>`
            : ""
        }
        ${
          trade.notes
            ? `<div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border)">
                <div class="form-label" style="margin-bottom:var(--sp-2)">Notes</div>
                <div style="white-space:pre-wrap">${esc(trade.notes)}</div>
              </div>`
            : ""
        }
        ${
          trade.risk_override
            ? `<div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border)">
                <div class="form-label" style="margin-bottom:var(--sp-2);color:var(--loss)">⚠ Risk override recorded</div>
                <div style="white-space:pre-wrap">${esc(trade.risk_override)}</div>
              </div>`
            : ""
        }
      </div>
    </div>

    ${
      trade.status === "closed"
        ? `<div class="section">
            <div class="section-header"><h2>Review</h2></div>
            <div id="review-card"></div>
           </div>`
        : ""
    }

    <div class="section" id="image-section"></div>
  `;

  function mount(pageEl) {
    pageEl.querySelector("#btn-delete").addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Delete trade",
        message: "Delete this trade? This cannot be undone.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
      await deleteTrade(trade.id);
      location.hash = "#/trades";
    });
    mountImageGallery(pageEl.querySelector("#image-section"), {
      tradeId: trade.id,
    });

    const reviewCard = pageEl.querySelector("#review-card");
    if (reviewCard) {
      // Local working copy of the trade so the card can re-render without
      // a full page refresh after save.
      let localTrade = { ...trade };
      let editing = !localTrade.review_completed;

      function paint() {
        reviewCard.innerHTML = editing
          ? renderReviewForm(localTrade)
          : renderReviewSummary(localTrade);
        wire();
      }

      function wire() {
        const form = reviewCard.querySelector("#review-form");
        if (form) {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const pf = fd.get("plan_followed");
            const data = {
              plan_followed:
                pf === "yes" ? true : pf === "no" ? false : null,
              exit_discipline: fd.get("exit_discipline")
                ? Number(fd.get("exit_discipline"))
                : null,
              emotional_state: fd.get("emotional_state") || null,
              lessons: (fd.get("lessons") || "").trim() || null,
            };
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            try {
              await setReview(trade.id, data);
              // Reflect saved state locally.
              localTrade = {
                ...localTrade,
                ...data,
                review_completed: 1,
                reviewed_at: new Date().toISOString(),
              };
              editing = false;
              paint();
              // Also update the header badge without a full reload.
              const header = pageEl.querySelector(".page-header h1");
              if (header) {
                const needsBadge = header.querySelector(".badge-needs-review");
                if (needsBadge) {
                  needsBadge.classList.remove("badge-needs-review");
                  needsBadge.classList.add("badge-reviewed");
                  needsBadge.textContent = "reviewed";
                }
              }
            } catch (err) {
              console.error("review save failed:", err);
              const errEl = reviewCard.querySelector(".review-error");
              if (errEl) errEl.textContent = String(err.message || err);
            } finally {
              if (submitBtn) submitBtn.disabled = false;
            }
          });
        }
        const editBtn = reviewCard.querySelector("#btn-edit-review");
        if (editBtn) {
          editBtn.addEventListener("click", () => {
            editing = true;
            paint();
          });
        }
      }

      paint();
    }
  }

  return { html, mount };
}

function renderReviewForm(t) {
  const pf = t.plan_followed;
  const ed = t.exit_discipline;
  const es = t.emotional_state;
  const stateOpts = [""]
    .concat(EMOTIONAL_STATES)
    .map(
      (s) =>
        `<option value="${s}"${es === s ? " selected" : ""}>${
          s ? s.charAt(0).toUpperCase() + s.slice(1) : "—"
        }</option>`
    )
    .join("");
  const edOpts = [""]
    .concat([1, 2, 3, 4, 5])
    .map(
      (n) =>
        `<option value="${n}"${
          ed != null && Number(ed) === Number(n) ? " selected" : ""
        }>${n || "—"}</option>`
    )
    .join("");
  return `
    <div class="card review-card">
      ${
        !t.review_completed
          ? `<p class="muted" style="margin:0 0 var(--sp-3) 0">
              Take 60 seconds to review the trade while it's fresh. This is how
              a journal actually compounds.
            </p>`
          : ""
      }
      <form id="review-form">
        <div class="form-grid">
          <div class="form-row">
            <label>Did you follow your plan?</label>
            <div class="radio-group">
              <label><input type="radio" name="plan_followed" value="yes" ${
                pf === 1 || pf === true ? "checked" : ""
              }> Yes</label>
              <label><input type="radio" name="plan_followed" value="no" ${
                pf === 0 || pf === false ? "checked" : ""
              }> No</label>
              <label><input type="radio" name="plan_followed" value="" ${
                pf == null ? "checked" : ""
              }> N/A</label>
            </div>
          </div>
          <div class="form-row">
            <label>Exit discipline (1–5)</label>
            <select name="exit_discipline">${edOpts}</select>
            <div class="help">1 = panic / impulse, 5 = textbook execution.</div>
          </div>
          <div class="form-row">
            <label>Emotional state</label>
            <select name="emotional_state">${stateOpts}</select>
          </div>
        </div>
        <div class="form-row">
          <label>Lessons</label>
          <textarea name="lessons" rows="4" placeholder="What did you learn? What would you do differently next time?">${esc(
            t.lessons || ""
          )}</textarea>
        </div>
        <div class="review-error form-error"></div>
        <div class="form-actions">
          <button type="submit" class="primary">
            ${t.review_completed ? "Save review" : "Mark reviewed"}
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderReviewSummary(t) {
  const pfLabel =
    t.plan_followed == null
      ? `<span class="dim">—</span>`
      : t.plan_followed
      ? `<span class="profit">Yes</span>`
      : `<span class="loss">No</span>`;
  const reviewed = t.reviewed_at ? fmtDateTime(t.reviewed_at) : "";
  return `
    <div class="card review-card">
      <div class="section-header" style="margin-bottom:var(--sp-2)">
        <div class="dim" style="font-size:var(--fs-sm)">Reviewed ${esc(
          reviewed
        )}</div>
        <button id="btn-edit-review" class="btn-sm">Edit review</button>
      </div>
      <dl class="kv">
        <dt>Plan followed</dt><dd>${pfLabel}</dd>
        <dt>Exit discipline</dt>
        <dd>${t.exit_discipline != null ? t.exit_discipline + " / 5" : "—"}</dd>
        <dt>Emotional state</dt>
        <dd>${
          t.emotional_state
            ? esc(
                t.emotional_state.charAt(0).toUpperCase() +
                  t.emotional_state.slice(1)
              )
            : "—"
        }</dd>
      </dl>
      ${
        t.lessons
          ? `<div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border)">
              <div class="form-label" style="margin-bottom:var(--sp-2)">Lessons</div>
              <div style="white-space:pre-wrap">${esc(t.lessons)}</div>
            </div>`
          : ""
      }
    </div>
  `;
}

// ---------- FORM (new + edit) ----------

export async function renderForm(params = {}) {
  const isEdit = !!params.id;
  // Bank accounts don't trade — they're real-money ledger buckets only.
  // Exclude them from the account picker so users can't accidentally log
  // a trade against a transfer account.
  const allAccounts = await listAccounts({ includeArchived: false });
  const accounts = allAccounts.filter((a) => a.category !== "bank");
  const instruments = await listInstruments();

  if (accounts.length === 0) {
    return {
      html: `
        <div class="page-header"><h1>Need an account first</h1></div>
        <div class="card empty-state">
          <p>You need at least one active account before you can log a trade.</p>
          <p><a href="#/accounts">Go to Accounts →</a></p>
        </div>
      `,
    };
  }

  // ?from_plan=ID prefills the form from a plan and links them on save.
  const fromPlanId = readQueryParam("from_plan");
  let sourcePlan = null;
  if (fromPlanId && !isEdit) {
    sourcePlan = await getPlan(fromPlanId);
  }

  let trade;
  if (isEdit) {
    trade = await getTrade(params.id);
    if (!trade) {
      return {
        html: `<div class="card"><p>Trade not found. <a href="#/trades">Back</a></p></div>`,
      };
    }
  } else if (sourcePlan) {
    trade = {
      account_id: sourcePlan.account_id,
      instrument: sourcePlan.instrument,
      direction: sourcePlan.direction,
      entry_time: nowLocalIso(),
      entry_price: sourcePlan.entry_price,
      stop_price: sourcePlan.stop_price,
      target_price: sourcePlan.target_price,
      contracts: sourcePlan.contracts,
      fees: 0,
      exit_time: "",
      exit_price: "",
      confidence: "",
      notes: sourcePlan.thesis || "",
      plan_id: sourcePlan.id,
    };
  } else {
    trade = {
      account_id: await pickDefaultAccountId(accounts),
      instrument: "ES",
      direction: "long",
      entry_time: nowLocalIso(),
      entry_price: "",
      stop_price: "",
      target_price: "",
      contracts: 1,
      fees: 0,
      exit_time: "",
      exit_price: "",
      confidence: "",
      notes: "",
    };
  }

  const grouped = groupByCategory(instruments);
  const instrumentOpts = Object.entries(grouped)
    .map(
      ([cat, list]) =>
        `<optgroup label="${esc(CATEGORY_LABELS[cat] || cat)}">${list
          .map(
            (i) =>
              `<option value="${esc(i.symbol)}"${
                trade.instrument === i.symbol ? " selected" : ""
              }>${esc(i.symbol)} — ${esc(i.name)}</option>`
          )
          .join("")}</optgroup>`
    )
    .join("");

  const accountOpts = accounts
    .map(
      (a) =>
        `<option value="${a.id}"${
          Number(trade.account_id) === a.id ? " selected" : ""
        }>${esc(a.name)}</option>`
    )
    .join("");

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">${
          sourcePlan
            ? `<a href="#/plans/${sourcePlan.id}">← Plan</a>`
            : `<a href="#/trades">← Trades</a>`
        }</div>
        <h1>${isEdit ? "Edit trade" : sourcePlan ? "Take plan" : "New trade"}</h1>
        ${
          sourcePlan
            ? `<div class="muted" style="margin-top:4px">From plan: ${esc(
                sourcePlan.instrument
              )} ${sourcePlan.direction} @ ${fmtNumber(
                sourcePlan.entry_price,
                4
              )}</div>`
            : ""
        }
      </div>
    </div>

    <form id="trade-form" autocomplete="off">
      <div class="card">
        <div class="form-grid">
          <div class="form-row">
            <label>Account <span class="req">*</span></label>
            <select name="account_id" required aria-required="true">${accountOpts}</select>
            <div class="field-error" data-for="account_id"></div>
          </div>
          <div class="form-row">
            <label>Instrument <span class="req">*</span></label>
            <select name="instrument" required aria-required="true">${instrumentOpts}</select>
            <div class="tick-info" id="tick-info"></div>
            <div class="field-error" data-for="instrument"></div>
          </div>
        </div>

        <div class="form-row">
          <label>Direction <span class="req">*</span></label>
          <div class="radio-group">
            <label><input type="radio" name="direction" value="long" ${
              trade.direction === "long" ? "checked" : ""
            }> Long</label>
            <label><input type="radio" name="direction" value="short" ${
              trade.direction === "short" ? "checked" : ""
            }> Short</label>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label>Entry time <span class="req">*</span></label>
            <input type="datetime-local" name="entry_time" required aria-required="true" value="${esc(
              isoToLocal(trade.entry_time)
            )}">
            <div class="field-error" data-for="entry_time"></div>
          </div>
          <div class="form-row">
            <label>Contracts <span class="req">*</span></label>
            <input type="number" name="contracts" min="1" step="1" required aria-required="true" inputmode="numeric" value="${
              trade.contracts ?? 1
            }">
            <div class="field-error" data-for="contracts"></div>
          </div>
          <div class="form-row">
            <label>Entry price <span class="req">*</span></label>
            <span class="input-currency"><input type="number" name="entry_price" step="any" required aria-required="true" inputmode="decimal" value="${
              trade.entry_price ?? ""
            }"></span>
            <div class="field-error" data-for="entry_price"></div>
          </div>
          <div class="form-row">
            <label>Stop price <span class="req">*</span></label>
            <span class="input-currency"><input type="number" name="stop_price" step="any" required aria-required="true" inputmode="decimal" value="${
              trade.stop_price ?? ""
            }"></span>
            <div class="field-error" data-for="stop_price"></div>
          </div>
          <div class="form-row">
            <label>Target price <span class="opt">optional</span></label>
            <span class="input-currency"><input type="number" name="target_price" step="any" inputmode="decimal" value="${
              trade.target_price ?? ""
            }"></span>
            <div class="field-error" data-for="target_price"></div>
          </div>
          <div class="form-row">
            <label>Fees <span class="opt">optional</span></label>
            <span class="input-currency"><input type="number" name="fees" step="0.01" min="0" inputmode="decimal" value="${
              trade.fees ?? 0
            }"></span>
            <div class="field-error" data-for="fees"></div>
          </div>
        </div>
      </div>

      <div id="unplanned-notice"></div>
      <div class="preview" id="preview"></div>
      <div id="risk-panel"></div>

      <div class="card">
        <h3 style="margin-bottom:var(--sp-3)">Exit <span class="opt" style="font-size:var(--fs-sm);font-weight:400">leave blank if still open</span></h3>
        <div class="form-grid">
          <div class="form-row">
            <label>Exit time <span class="opt">optional</span></label>
            <input type="datetime-local" name="exit_time" value="${esc(
              isoToLocal(trade.exit_time)
            )}">
            <div class="field-error" data-for="exit_time"></div>
          </div>
          <div class="form-row">
            <label>Exit price <span class="opt">optional</span></label>
            <span class="input-currency"><input type="number" name="exit_price" step="any" inputmode="decimal" value="${
              trade.exit_price ?? ""
            }"></span>
            <div class="field-error" data-for="exit_price"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="form-row">
          <label>Tags</label>
          <div id="tag-picker-mount"></div>
        </div>
        <div class="form-row">
          <label>Confidence (1–5)</label>
          <select name="confidence">
            <option value="">—</option>
            ${[1, 2, 3, 4, 5]
              .map(
                (n) =>
                  `<option value="${n}"${
                    trade.confidence == n ? " selected" : ""
                  }>${n}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="form-row">
          <label>Notes</label>
          <textarea name="notes" placeholder="Setup, levels, what you saw, what you'd do differently...">${esc(
            trade.notes || ""
          )}</textarea>
        </div>
      </div>

      <div class="section" id="image-section"></div>

      <div class="form-error"></div>
      <div class="form-actions">
        <a href="#${isEdit ? "/trades/" + trade.id : "/trades"}"><button type="button">Cancel</button></a>
        <button type="submit" class="primary">${
          isEdit ? "Save changes" : "Log trade"
        }</button>
      </div>
    </form>
  `;

  // Tag data for the picker (loaded outside mount so we can await).
  const allTags = await listTags();
  const initialSelectedTagIds = isEdit
    ? (await getTradeTags(trade.id)).map((t) => t.id)
    : [];

  function mount(pageEl) {
    const form = pageEl.querySelector("#trade-form");
    const tickInfo = pageEl.querySelector("#tick-info");
    const previewEl = pageEl.querySelector("#preview");
    const riskPanelEl = pageEl.querySelector("#risk-panel");
    const unplannedEl = pageEl.querySelector("#unplanned-notice");
    const errEl = pageEl.querySelector(".form-error");
    const tagMountEl = pageEl.querySelector("#tag-picker-mount");
    const tagPicker = mountTagPicker(
      tagMountEl,
      allTags,
      initialSelectedTagIds
    );

    // Account cache for risk eval, keyed by id.
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    // Instruments are already fetched at render time; build a symbol→row
    // map once and hand it to assessDraft on every debounced tick so the
    // risk eval doesn't re-fetch the instruments table each keystroke.
    const instrumentMap = new Map(instruments.map((i) => [i.symbol, i]));
    // Latest risk assessment, updated by updateRiskPanel(). Submit reads this
    // instead of re-running the async eval.
    let latestAssessment = null;

    // Image gallery: pending for new trades, DB-backed for edits.
    let galleryHandle = null;
    (async () => {
      galleryHandle = await mountImageGallery(
        pageEl.querySelector("#image-section"),
        isEdit ? { tradeId: trade.id } : { pending: true }
      );
    })();

    function currentInstrument() {
      const sym = form.elements.instrument.value;
      return instruments.find((i) => i.symbol === sym) || null;
    }

    function updateTickInfo() {
      const inst = currentInstrument();
      if (!inst) {
        tickInfo.textContent = "";
        return;
      }
      tickInfo.textContent = `${inst.exchange} · tick ${inst.tick_size} = ${fmtMoney(
        inst.tick_value
      )} · point ${fmtMoney(inst.point_value)}`;
    }

    function readDraft() {
      const fd = new FormData(form);
      return {
        account_id: Number(fd.get("account_id")) || null,
        instrument: fd.get("instrument") || null,
        direction: fd.get("direction") || null,
        entry_time: fd.get("entry_time")
          ? new Date(fd.get("entry_time")).toISOString()
          : null,
        entry_price: numOrNull(fd.get("entry_price")),
        stop_price: numOrNull(fd.get("stop_price")),
        target_price: numOrNull(fd.get("target_price")),
        contracts: intOrNull(fd.get("contracts")),
        fees: numOrNull(fd.get("fees")) || 0,
        exit_time: fd.get("exit_time")
          ? new Date(fd.get("exit_time")).toISOString()
          : null,
        exit_price: numOrNull(fd.get("exit_price")),
        confidence: intOrNull(fd.get("confidence")),
        notes: fd.get("notes") || null,
      };
    }

    function updatePreview() {
      const draft = readDraft();
      const inst = currentInstrument();
      const risk = tradeRisk(draft, inst);
      const pnl = tradePnL(draft, inst);
      const r = rMultiple(draft, inst);
      const pRR = plannedRR(draft);

      const cells = [];
      cells.push(`
        <div class="stat">
          <div class="stat-label">Risk</div>
          <div class="stat-value">${risk ? fmtMoney(risk.dollars) : "—"}</div>
          <div class="stat-sub">${
            risk ? fmtNumber(risk.points, 2) + " pts" : ""
          }</div>
        </div>
      `);
      if (pRR != null) {
        cells.push(`
          <div class="stat">
            <div class="stat-label">Planned R:R</div>
            <div class="stat-value">${pRR.toFixed(2)}</div>
          </div>
        `);
      }
      if (pnl) {
        const c = pnl.dollars > 0 ? "profit" : pnl.dollars < 0 ? "loss" : "";
        cells.push(`
          <div class="stat">
            <div class="stat-label">P&amp;L</div>
            <div class="stat-value ${c}">${fmtMoney(pnl.dollars, {
          signed: true,
        })}</div>
            <div class="stat-sub">${
              (pnl.points > 0 ? "+" : "") + pnl.points.toFixed(2)
            } pts</div>
          </div>
        `);
      }
      if (r != null) {
        const c = r > 0 ? "profit" : "loss";
        cells.push(`
          <div class="stat">
            <div class="stat-label">R-multiple</div>
            <div class="stat-value ${c}">${
          (r > 0 ? "+" : "") + r.toFixed(2)
        }R</div>
          </div>
        `);
      }
      previewEl.innerHTML = cells.join("");
    }

    // Debounced async risk assessment. Only runs when the draft has enough
    // shape to be evaluable (account + instrument + prices + contracts).
    let riskTimer = null;
    let riskSeq = 0;
    // If the user navigates away before the debounced timer fires, the
    // pending async callback would set innerHTML on a detached DOM node.
    // Cancel the timer and invalidate the seq so the async body bails out.
    registerPageCleanup(() => {
      if (riskTimer) clearTimeout(riskTimer);
      riskSeq = Number.MAX_SAFE_INTEGER;
    });
    function updateRiskPanel() {
      if (riskTimer) clearTimeout(riskTimer);
      riskTimer = setTimeout(async () => {
        const draft = readDraft();
        const account = accountById.get(draft.account_id);
        const inst = currentInstrument();
        // Can't evaluate yet — clear any stale output.
        if (
          !account ||
          !inst ||
          !Number.isFinite(draft.entry_price) ||
          !Number.isFinite(draft.stop_price) ||
          !Number.isInteger(draft.contracts) ||
          draft.contracts < 1
        ) {
          latestAssessment = null;
          riskPanelEl.innerHTML = "";
          return;
        }
        // Skip risk eval when editing a trade that's already closed — the
        // guardrails are a pre-trade concept.
        if (isEdit && trade.status === "closed") {
          latestAssessment = null;
          riskPanelEl.innerHTML = "";
          return;
        }
        const mySeq = ++riskSeq;
        try {
          const assessment = await assessDraft({
            account,
            instrument: inst,
            draft,
            excludeTradeId: isEdit ? trade.id : null,
            instrumentMap,
          });
          // Discard stale results if the user kept typing.
          if (mySeq !== riskSeq) return;
          latestAssessment = assessment;
          riskPanelEl.innerHTML = renderRiskPanel(assessment, account);
        } catch (err) {
          console.error("risk assessment failed:", err);
          latestAssessment = null;
          riskPanelEl.innerHTML = "";
        }
      }, 120);
    }

    // Soft amber nudge when logging an unplanned trade on a funded account.
    // Non-blocking — just a visible reminder that discipline starts with
    // having a plan. Hidden for edits, "Take plan" flows, and cash accounts.
    function updateUnplannedNotice() {
      if (isEdit || sourcePlan) {
        unplannedEl.innerHTML = "";
        return;
      }
      const draft = readDraft();
      const account = accountById.get(draft.account_id);
      if (!account || account.type !== "funded") {
        unplannedEl.innerHTML = "";
        return;
      }
      unplannedEl.innerHTML = `
        <div class="card unplanned-notice">
          <strong>⚠ Logging an unplanned trade</strong>
          <div class="dim" style="font-size:var(--fs-sm);margin-top:4px">
            This is a funded account. Consider
            <a href="#/plans/new">writing a plan first</a> —
            planned trades give you a reference point when things go sideways.
          </div>
        </div>
      `;
    }

    form.addEventListener("input", () => {
      updateTickInfo();
      updatePreview();
      updateRiskPanel();
      updateUnplannedNotice();
    });
    form.addEventListener("change", () => {
      updateTickInfo();
      updatePreview();
      updateRiskPanel();
      updateUnplannedNotice();
    });

    // Inline validation. Each validator runs on blur and on submit; errors
    // appear under the offending field. We piggyback on readDraft so the
    // direction-aware checks (long stop < entry, etc.) match the same shape
    // the submit handler uses.
    const validator = attachValidator(form, {
      account_id: (v) => (!v ? "Account is required." : null),
      instrument: (v) => (!v ? "Instrument is required." : null),
      entry_time: (v) => (!v ? "Entry time is required." : null),
      contracts: (v) => {
        const n = Number(v);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1)
          return "Must be a positive whole number.";
        return null;
      },
      entry_price: (v) => priceErr(v, "Entry price"),
      stop_price: () => {
        const d = readDraft();
        if (!Number.isFinite(d.stop_price) || d.stop_price <= 0)
          return "Stop price must be a positive number.";
        if (Number.isFinite(d.entry_price)) {
          if (d.direction === "long" && d.stop_price >= d.entry_price)
            return "For a long, stop must be below entry.";
          if (d.direction === "short" && d.stop_price <= d.entry_price)
            return "For a short, stop must be above entry.";
        }
        return null;
      },
      target_price: () => {
        const d = readDraft();
        if (d.target_price == null) return null;
        if (!Number.isFinite(d.target_price) || d.target_price <= 0)
          return "Target must be a positive number.";
        if (Number.isFinite(d.entry_price)) {
          if (d.direction === "long" && d.target_price <= d.entry_price)
            return "For a long, target must be above entry.";
          if (d.direction === "short" && d.target_price >= d.entry_price)
            return "For a short, target must be below entry.";
        }
        return null;
      },
      fees: (v) => {
        if (v === "" || v == null) return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0)
          return "Fees must be zero or positive.";
        return null;
      },
      exit_price: () => {
        const d = readDraft();
        if (d.exit_price == null && !d.exit_time) return null;
        if (d.exit_price == null) return "Exit price is required when exit time is set.";
        if (!Number.isFinite(d.exit_price) || d.exit_price <= 0)
          return "Exit price must be a positive number.";
        return null;
      },
      exit_time: () => {
        const d = readDraft();
        if (!d.exit_time && d.exit_price == null) return null;
        if (!d.exit_time) return "Exit time is required when exit price is set.";
        if (d.entry_time && d.exit_time <= d.entry_time)
          return "Exit time must be after entry time.";
        return null;
      },
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.textContent = "";
      // Inline field validation runs first; if any field fails, focus the
      // first one and bail before touching the risk engine.
      const { ok, firstField } = validator.runAll();
      if (!ok) {
        const el = form.elements[firstField];
        if (el && typeof el.focus === "function") el.focus();
        return;
      }
      const draft = readDraft();

      const err = validateTradeShape(draft);
      if (err) {
        errEl.textContent = err;
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("btn-loading");
      }
      try {
        // Pre-trade risk check. Only blocks on new trades or when editing an
        // open trade (closed-trade edits skip guardrails in updateRiskPanel).
        if (!(isEdit && trade.status === "closed")) {
          // Make sure we have an up-to-date assessment. If the user typed fast,
          // the debounced one might be stale or not yet populated.
          const account = accountById.get(draft.account_id);
          const inst = currentInstrument();
          if (account && inst) {
            try {
              latestAssessment = await assessDraft({
                account,
                instrument: inst,
                draft,
                excludeTradeId: isEdit ? trade.id : null,
                instrumentMap,
              });
            } catch (assessErr) {
              console.error("final risk assessment failed:", assessErr);
            }
          }
          if (latestAssessment && latestAssessment.blockers.length > 0) {
            const override = await promptRiskOverride(latestAssessment);
            if (!override.proceed) return;
            draft.risk_override = override.reason;
          }
        }

        try {
          let savedId;
          if (isEdit) {
            await updateTrade(trade.id, draft);
            savedId = trade.id;
          } else {
            if (sourcePlan) draft.plan_id = sourcePlan.id;
            savedId = await createTrade(draft);
            if (sourcePlan) {
              await setPlanStatus(sourcePlan.id, "taken", savedId);
            }
          }
          await setTradeTags(savedId, tagPicker.getSelected());
          if (!isEdit && galleryHandle) {
            await galleryHandle.commitPending({ tradeId: savedId });
          }
          location.hash = `#/trades/${savedId}`;
        } catch (err) {
          console.error(err);
          errEl.textContent = String(err.message || err);
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("btn-loading");
        }
      }
    });

    updateTickInfo();
    updatePreview();
    updateRiskPanel();
    updateUnplannedNotice();
  }

  return { html, mount };
}

// Renders the risk budget card that sits under the trade form preview.
// Shows daily P&L use, open exposure, and any blockers/warnings.
function renderRiskPanel(assessment, account) {
  const c = assessment.computed;
  const hasDll = c.dailyLossLimit != null && c.dailyLossLimit > 0;

  // Daily budget used: absolute value of negative P&L plus all open-risk
  // worst-case, as a % of the daily loss limit.
  let budgetBar = "";
  if (hasDll) {
    const usedBase = Math.max(0, -c.dailyPnl) + c.openRisk;
    const withProposed = usedBase + c.proposedRisk;
    const pctBase = Math.min(100, (usedBase / c.dailyLossLimit) * 100);
    const pctWith = Math.min(100, (withProposed / c.dailyLossLimit) * 100);
    const overBudget = withProposed > c.dailyLossLimit;
    const barColor = overBudget
      ? "var(--loss)"
      : pctWith > 80
      ? "var(--warn, #f0b429)"
      : "var(--profit)";
    budgetBar = `
      <div class="risk-budget">
        <div class="risk-budget-label">
          <span>Daily loss budget</span>
          <span class="${overBudget ? "loss" : ""}">
            ${fmtMoney(withProposed)} of ${fmtMoney(c.dailyLossLimit)}
            <span class="dim">(${pctWith.toFixed(0)}%)</span>
          </span>
        </div>
        <div class="risk-budget-track" style="position:relative;height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-top:4px">
          <div style="position:absolute;inset:0 auto 0 0;width:${pctBase}%;background:var(--border-strong, #475569)"></div>
          <div style="position:absolute;inset:0 auto 0 0;width:${pctWith}%;background:${barColor};opacity:0.6"></div>
        </div>
      </div>
    `;
  }

  const stats = `
    <div class="risk-stats">
      <div>
        <span class="dim">Today realized</span>
        <strong class="${c.dailyPnl < 0 ? "loss" : c.dailyPnl > 0 ? "profit" : ""}">
          ${fmtMoney(c.dailyPnl, { signed: true })}
        </strong>
      </div>
      <div>
        <span class="dim">Open risk</span>
        <strong>${fmtMoney(c.openRisk)}</strong>
        <span class="dim">(${c.openContracts} ct)</span>
      </div>
      <div>
        <span class="dim">This trade</span>
        <strong>${fmtMoney(c.proposedRisk)}</strong>
        <span class="dim">(${c.proposedContracts} ct)</span>
      </div>
    </div>
  `;

  const issueItems = (items, cls) =>
    items
      .map(
        (i) => `
          <li class="${cls}">
            <strong>${esc(i.message)}</strong>
            ${i.detail ? `<div class="dim" style="font-size:var(--fs-xs)">${esc(i.detail)}</div>` : ""}
          </li>
        `
      )
      .join("");

  const blockers = assessment.blockers.length
    ? `<ul class="risk-issues">${issueItems(assessment.blockers, "risk-blocker")}</ul>`
    : "";
  const warnings = assessment.warnings.length
    ? `<ul class="risk-issues">${issueItems(assessment.warnings, "risk-warning")}</ul>`
    : "";

  const tone =
    assessment.blockers.length > 0
      ? "danger"
      : assessment.warnings.length > 0
      ? "warn"
      : "ok";

  return `
    <div class="card risk-panel risk-panel-${tone}">
      <div class="risk-panel-header">
        <strong>Risk check</strong>
        <span class="dim">${esc(account.name)}</span>
      </div>
      ${budgetBar}
      ${stats}
      ${blockers}
      ${warnings}
    </div>
  `;
}

// Promise-based override modal for blocked trades. Returns
// { proceed: bool, reason: string|null }.
function promptRiskOverride(assessment) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
      closeModal();
    };

    const wrap = document.createElement("div");
    const blockerList = assessment.blockers
      .map(
        (b) => `
          <li class="risk-blocker">
            <strong>${esc(b.message)}</strong>
            ${b.detail ? `<div class="dim" style="font-size:var(--fs-xs)">${esc(b.detail)}</div>` : ""}
          </li>
        `
      )
      .join("");

    wrap.innerHTML = `
      <p style="margin:0 0 var(--sp-3) 0">
        This trade would violate one or more of your account's risk rules.
        You can override, but the reason will be recorded on the trade.
      </p>
      <ul class="risk-issues" style="margin:0 0 var(--sp-4) 0">${blockerList}</ul>
      <label style="display:block;margin-bottom:var(--sp-2);font-size:var(--fs-sm);color:var(--text)">
        <input type="checkbox" id="risk-ack" style="margin-right:6px">
        I understand the risk and want to proceed anyway.
      </label>
      <div class="form-row">
        <label>Reason (optional, but recommended)</label>
        <textarea id="risk-reason" rows="3" placeholder="Why are you overriding? e.g. 'High-conviction setup, smaller size than usual.'"></textarea>
      </div>
      <div class="form-actions" style="justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-3)">
        <button type="button" id="risk-cancel">Cancel</button>
        <button type="button" id="risk-proceed" class="btn-danger" disabled>Override and log trade</button>
      </div>
    `;

    const ack = wrap.querySelector("#risk-ack");
    const reason = wrap.querySelector("#risk-reason");
    const proceedBtn = wrap.querySelector("#risk-proceed");
    const cancelBtn = wrap.querySelector("#risk-cancel");

    ack.addEventListener("change", () => {
      proceedBtn.disabled = !ack.checked;
    });
    cancelBtn.addEventListener("click", () =>
      finish({ proceed: false, reason: null })
    );
    proceedBtn.addEventListener("click", () => {
      if (!ack.checked) return;
      const txt = reason.value.trim();
      finish({ proceed: true, reason: txt || "(no reason given)" });
    });

    openModal({
      title: "Risk check failed",
      body: wrap,
      width: 520,
      onClose: () => finish({ proceed: false, reason: null }),
    });
    cancelBtn.focus();
  });
}

// ---------- helpers ----------

function readQueryParam(name) {
  const hash = location.hash;
  const q = hash.indexOf("?");
  if (q < 0) return null;
  const sp = new URLSearchParams(hash.slice(q + 1));
  return sp.get(name);
}

async function pickDefaultAccountId(accounts) {
  // Caller already filters `accounts` to active, non-bank entries.
  // If the user's stored default is gone (deleted, archived, or now a
  // bank account), fall through to the first remaining active account.
  const stored = await getSetting(SETTING_KEYS.defaultAccountId);
  if (stored) {
    const found = accounts.find((a) => a.id === Number(stored));
    if (found) return found.id;
  }
  return accounts[0]?.id ?? null;
}

function nowLocalIso() {
  return new Date().toISOString();
}

function isoToLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  // Convert to local time for datetime-local input.
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
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

// Shared price validator: required, finite, > 0.
function priceErr(v, label) {
  const n = Number(v);
  if (v === "" || v == null) return `${label} is required.`;
  if (!Number.isFinite(n) || n <= 0) return `${label} must be a positive number.`;
  return null;
}
