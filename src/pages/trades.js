import {
  listTrades,
  getTrade,
  createTrade,
  updateTrade,
  deleteTrade,
} from "../lib/trades.js";
import { getPlan, setPlanStatus } from "../lib/plans.js";
import { listAccounts } from "../lib/accounts.js";
import { listTags, getTradeTags, setTradeTags } from "../lib/tags.js";
import { mountTagPicker } from "../components/tag-picker.js";
import { mountImageGallery } from "../components/image-gallery.js";
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
import {
  fmtMoney,
  fmtNumber,
  fmtDate,
  fmtDateTime,
  esc,
} from "../lib/format.js";
import { refreshPage } from "../main.js";

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

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Execution</div>
        <h1>Trades</h1>
      </div>
      <a href="#/trades/new"><button class="primary">+ New trade</button></a>
    </div>

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
                : `Try clearing filters, or log your first trade.`
            }</p>
          </div>`
        : `<div class="card" style="padding:0">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th class="num">Qty</th>
                  <th class="num">Entry</th>
                  <th class="num">Exit</th>
                  <th class="num">R</th>
                  <th class="num">P&amp;L</th>
                  <th>Status</th>
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
      location.hash = "#/trades" + (params.toString() ? "?" + params : "");
    });
    pageEl.querySelector("#btn-clear").addEventListener("click", () => {
      location.hash = "#/trades";
    });
    pageEl.querySelectorAll("tr.clickable").forEach((tr) => {
      tr.addEventListener("click", () => {
        location.hash = `#/trades/${tr.dataset.id}`;
      });
    });
  }

  return { html, mount };
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

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs"><a href="#/trades">← Trades</a></div>
        <h1>${esc(trade.instrument)}
          <span class="badge ${trade.direction}" style="margin-left:8px;vertical-align:middle">${trade.direction}</span>
          <span class="badge ${trade.status}" style="margin-left:4px;vertical-align:middle">${trade.status}</span>
        </h1>
        <div class="muted" style="margin-top:4px">
          ${esc(trade.account_name)} · ${fmtDateTime(trade.entry_time)}
          ${
            trade.plan_id
              ? ` · <a href="#/plans/${trade.plan_id}">from plan #${trade.plan_id}</a>`
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
      </div>
    </div>

    <div class="section" id="image-section"></div>
  `;

  function mount(pageEl) {
    pageEl.querySelector("#btn-delete").addEventListener("click", async () => {
      if (!confirm("Delete this trade? This cannot be undone.")) return;
      await deleteTrade(trade.id);
      location.hash = "#/trades";
    });
    mountImageGallery(pageEl.querySelector("#image-section"), {
      tradeId: trade.id,
    });
  }

  return { html, mount };
}

// ---------- FORM (new + edit) ----------

export async function renderForm(params = {}) {
  const isEdit = !!params.id;
  const accounts = await listAccounts({ includeArchived: false });
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
      account_id: accounts[0].id,
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
            <label>Account</label>
            <select name="account_id" required>${accountOpts}</select>
          </div>
          <div class="form-row">
            <label>Instrument</label>
            <select name="instrument" required>${instrumentOpts}</select>
            <div class="tick-info" id="tick-info"></div>
          </div>
        </div>

        <div class="form-row">
          <label>Direction</label>
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
            <label>Entry time</label>
            <input type="datetime-local" name="entry_time" required value="${esc(
              isoToLocal(trade.entry_time)
            )}">
          </div>
          <div class="form-row">
            <label>Contracts</label>
            <input type="number" name="contracts" min="1" step="1" required value="${
              trade.contracts ?? 1
            }">
          </div>
          <div class="form-row">
            <label>Entry price</label>
            <input type="number" name="entry_price" step="any" required value="${
              trade.entry_price ?? ""
            }">
          </div>
          <div class="form-row">
            <label>Stop price *</label>
            <input type="number" name="stop_price" step="any" required value="${
              trade.stop_price ?? ""
            }">
          </div>
          <div class="form-row">
            <label>Target (optional)</label>
            <input type="number" name="target_price" step="any" value="${
              trade.target_price ?? ""
            }">
          </div>
          <div class="form-row">
            <label>Fees ($)</label>
            <input type="number" name="fees" step="0.01" min="0" value="${
              trade.fees ?? 0
            }">
          </div>
        </div>
      </div>

      <div class="preview" id="preview"></div>

      <div class="card">
        <h3 style="margin-bottom:var(--sp-3)">Exit (leave blank if still open)</h3>
        <div class="form-grid">
          <div class="form-row">
            <label>Exit time</label>
            <input type="datetime-local" name="exit_time" value="${esc(
              isoToLocal(trade.exit_time)
            )}">
          </div>
          <div class="form-row">
            <label>Exit price</label>
            <input type="number" name="exit_price" step="any" value="${
              trade.exit_price ?? ""
            }">
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
    const errEl = pageEl.querySelector(".form-error");
    const tagMountEl = pageEl.querySelector("#tag-picker-mount");
    const tagPicker = mountTagPicker(
      tagMountEl,
      allTags,
      initialSelectedTagIds
    );

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

    form.addEventListener("input", () => {
      updateTickInfo();
      updatePreview();
    });
    form.addEventListener("change", () => {
      updateTickInfo();
      updatePreview();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.textContent = "";
      const draft = readDraft();

      const err = validateTradeShape(draft);
      if (err) {
        errEl.textContent = err;
        return;
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
    });

    updateTickInfo();
    updatePreview();
  }

  return { html, mount };
}

// ---------- helpers ----------

function readQueryParam(name) {
  const hash = location.hash;
  const q = hash.indexOf("?");
  if (q < 0) return null;
  const sp = new URLSearchParams(hash.slice(q + 1));
  return sp.get(name);
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
