import {
  listPlans,
  countPlansByStatus,
  getPlan,
  createPlan,
  updatePlan,
  setPlanStatus,
  deletePlan,
} from "../lib/plans.js";
import { listAccounts } from "../lib/accounts.js";
import {
  listInstruments,
  getInstrument,
  groupByCategory,
  CATEGORY_LABELS,
} from "../lib/instruments.js";
import {
  tradeRisk,
  plannedRR,
  validatePlanShape,
} from "../lib/calc.js";
import { fmtMoney, fmtNumber, fmtDate, esc } from "../lib/format.js";
import { mountImageGallery } from "../components/image-gallery.js";
import { refreshPage } from "../main.js";

// ---------- LIST ----------

export async function renderList() {
  const status = readQueryParam("status") || "active";
  const counts = await countPlansByStatus();
  const plans = await listPlans({ status });

  const tab = (key, label) => {
    const n =
      key === "all"
        ? counts.all
        : counts[key] || 0;
    const active = key === status ? " active" : "";
    const href = key === "active" ? "#/plans" : `#/plans?status=${key}`;
    return `<a class="tab${active}" href="${href}">${label} <span class="dim">${n}</span></a>`;
  };

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Pre-trade</div>
        <h1>Plans</h1>
      </div>
      <a href="#/plans/new"><button class="primary">+ New plan</button></a>
    </div>

    <div class="tab-bar">
      ${tab("active", "Active")}
      ${tab("taken", "Taken")}
      ${tab("invalidated", "Invalidated")}
      ${tab("all", "All")}
    </div>

    ${
      plans.length === 0
        ? `<div class="card empty-state">
            <h3>No ${status === "all" ? "" : status + " "}plans</h3>
            <p>${
              status === "active"
                ? `Plan a setup before the open. Stop and target are required — if you can't pick them, you don't have a plan.`
                : `Switch tabs to see other plans.`
            }</p>
          </div>`
        : `<div class="card" style="padding:0">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Account</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th class="num">Qty</th>
                  <th class="num">Entry</th>
                  <th class="num">Stop</th>
                  <th class="num">Target</th>
                  <th class="num">R:R</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${plans.map(rowHtml).join("")}</tbody>
            </table>
          </div>`
    }
  `;

  function mount(pageEl) {
    pageEl.querySelectorAll("tr.clickable").forEach((tr) => {
      tr.addEventListener("click", () => {
        location.hash = `#/plans/${tr.dataset.id}`;
      });
    });
  }

  return { html, mount };
}

function rowHtml(p) {
  return `
    <tr class="clickable" data-id="${p.id}">
      <td>${fmtDate(p.created_at)}</td>
      <td>${esc(p.account_name)}</td>
      <td><strong>${esc(p.instrument)}</strong></td>
      <td><span class="badge ${p.direction}">${p.direction}</span></td>
      <td class="num">${p.contracts}</td>
      <td class="num">${fmtNumber(p.entry_price, 4)}</td>
      <td class="num">${fmtNumber(p.stop_price, 4)}</td>
      <td class="num">${fmtNumber(p.target_price, 4)}</td>
      <td class="num">${(p.rr_planned || 0).toFixed(2)}</td>
      <td><span class="badge ${p.status}">${p.status}</span></td>
    </tr>
  `;
}

// ---------- DETAIL ----------

export async function renderDetail({ id }) {
  const plan = await getPlan(id);
  if (!plan) {
    return {
      html: `
        <div class="page-header"><h1>Plan not found</h1></div>
        <div class="card"><p class="muted"><a href="#/plans">← Back to plans</a></p></div>
      `,
    };
  }
  const inst = await getInstrument(plan.instrument);
  const risk = tradeRisk(plan, inst);
  const rr = plannedRR(plan);

  const canTake = plan.status === "active";

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs"><a href="#/plans">← Plans</a></div>
        <h1>${esc(plan.instrument)}
          <span class="badge ${plan.direction}" style="margin-left:8px;vertical-align:middle">${plan.direction}</span>
          <span class="badge ${plan.status}" style="margin-left:4px;vertical-align:middle">${plan.status}</span>
        </h1>
        <div class="muted" style="margin-top:4px">
          ${esc(plan.account_name)} · created ${fmtDate(plan.created_at)}
          ${
            plan.trade_id
              ? ` · <a href="#/trades/${plan.trade_id}">→ Trade #${plan.trade_id}</a>`
              : ""
          }
        </div>
      </div>
      <div class="row-actions">
        ${
          canTake
            ? `<a href="#/trades/new?from_plan=${plan.id}"><button class="primary">Take trade</button></a>`
            : ""
        }
        ${
          canTake
            ? `<a href="#/plans/${plan.id}/edit"><button>Edit</button></a>`
            : ""
        }
        ${
          canTake
            ? `<button id="btn-invalidate">Invalidate</button>`
            : plan.status === "invalidated"
            ? `<button id="btn-reactivate">Reactivate</button>`
            : ""
        }
        <button class="btn-danger" id="btn-delete">Delete</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Contracts</div>
        <div class="stat-value">${plan.contracts}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Risk</div>
        <div class="stat-value">${risk ? fmtMoney(risk.dollars) : "—"}</div>
        <div class="stat-sub">${
          risk ? fmtNumber(risk.points, 2) + " pts" : ""
        }</div>
      </div>
      <div class="stat">
        <div class="stat-label">Planned R:R</div>
        <div class="stat-value">${rr ? rr.toFixed(2) : "—"}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Reward at target</div>
        <div class="stat-value">${
          risk && rr ? fmtMoney(risk.dollars * rr) : "—"
        }</div>
      </div>
    </div>

    <div class="section">
      <div class="card">
        <dl class="kv">
          <dt>Entry</dt><dd>${fmtNumber(plan.entry_price, 4)}</dd>
          <dt>Stop</dt><dd>${fmtNumber(plan.stop_price, 4)}</dd>
          <dt>Target</dt><dd>${fmtNumber(plan.target_price, 4)}</dd>
        </dl>
        ${
          plan.thesis
            ? `<div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border)">
                <div class="form-label" style="margin-bottom:var(--sp-2)">Thesis</div>
                <div style="white-space:pre-wrap">${esc(plan.thesis)}</div>
              </div>`
            : ""
        }
      </div>
    </div>

    <div class="section" id="image-section"></div>
  `;

  function mount(pageEl) {
    mountImageGallery(pageEl.querySelector("#image-section"), {
      planId: plan.id,
    });
    pageEl
      .querySelector("#btn-invalidate")
      ?.addEventListener("click", async () => {
        await setPlanStatus(plan.id, "invalidated");
        refreshPage();
      });
    pageEl
      .querySelector("#btn-reactivate")
      ?.addEventListener("click", async () => {
        await setPlanStatus(plan.id, "active");
        refreshPage();
      });
    pageEl
      .querySelector("#btn-delete")
      .addEventListener("click", async () => {
        if (!confirm("Delete this plan?")) return;
        await deletePlan(plan.id);
        location.hash = "#/plans";
      });
  }

  return { html, mount };
}

// ---------- FORM ----------

export async function renderForm(params = {}) {
  const isEdit = !!params.id;
  const accounts = await listAccounts({ includeArchived: false });
  const instruments = await listInstruments();

  if (accounts.length === 0) {
    return {
      html: `
        <div class="page-header"><h1>Need an account first</h1></div>
        <div class="card empty-state">
          <p>Add an active account before planning trades. <a href="#/accounts">Go →</a></p>
        </div>
      `,
    };
  }

  let plan;
  if (isEdit) {
    plan = await getPlan(params.id);
    if (!plan) {
      return {
        html: `<div class="card"><p>Plan not found. <a href="#/plans">Back</a></p></div>`,
      };
    }
    if (plan.status === "taken") {
      return {
        html: `
          <div class="page-header"><h1>Plan locked</h1></div>
          <div class="card empty-state">
            <p>This plan was already taken and can't be edited. <a href="#/plans/${plan.id}">← Back</a></p>
          </div>
        `,
      };
    }
  } else {
    plan = {
      account_id: accounts[0].id,
      instrument: "ES",
      direction: "long",
      entry_price: "",
      stop_price: "",
      target_price: "",
      contracts: 1,
      thesis: "",
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
                plan.instrument === i.symbol ? " selected" : ""
              }>${esc(i.symbol)} — ${esc(i.name)}</option>`
          )
          .join("")}</optgroup>`
    )
    .join("");

  const accountOpts = accounts
    .map(
      (a) =>
        `<option value="${a.id}"${
          Number(plan.account_id) === a.id ? " selected" : ""
        }>${esc(a.name)}</option>`
    )
    .join("");

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs"><a href="#/plans">← Plans</a></div>
        <h1>${isEdit ? "Edit plan" : "New plan"}</h1>
      </div>
    </div>

    <form id="plan-form" autocomplete="off">
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
              plan.direction === "long" ? "checked" : ""
            }> Long</label>
            <label><input type="radio" name="direction" value="short" ${
              plan.direction === "short" ? "checked" : ""
            }> Short</label>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label>Entry price</label>
            <input type="number" name="entry_price" step="any" required value="${
              plan.entry_price ?? ""
            }">
          </div>
          <div class="form-row">
            <label>Contracts</label>
            <input type="number" name="contracts" min="1" step="1" required value="${
              plan.contracts ?? 1
            }">
          </div>
          <div class="form-row">
            <label>Stop price *</label>
            <input type="number" name="stop_price" step="any" required value="${
              plan.stop_price ?? ""
            }">
          </div>
          <div class="form-row">
            <label>Target price *</label>
            <input type="number" name="target_price" step="any" required value="${
              plan.target_price ?? ""
            }">
          </div>
        </div>
      </div>

      <div class="preview" id="preview"></div>

      <div class="card">
        <div class="form-row">
          <label>Thesis</label>
          <textarea name="thesis" placeholder="Why this trade? Key levels, context, what would invalidate it.">${esc(
            plan.thesis || ""
          )}</textarea>
        </div>
      </div>

      <div class="form-error"></div>
      <div class="form-actions">
        <a href="#${isEdit ? "/plans/" + plan.id : "/plans"}"><button type="button">Cancel</button></a>
        <button type="submit" class="primary">${
          isEdit ? "Save changes" : "Create plan"
        }</button>
      </div>
    </form>
  `;

  function mount(pageEl) {
    const form = pageEl.querySelector("#plan-form");
    const tickInfo = pageEl.querySelector("#tick-info");
    const previewEl = pageEl.querySelector("#preview");
    const errEl = pageEl.querySelector(".form-error");

    function currentInstrument() {
      const sym = form.elements.instrument.value;
      return instruments.find((i) => i.symbol === sym) || null;
    }

    function updateTickInfo() {
      const inst = currentInstrument();
      tickInfo.textContent = inst
        ? `${inst.exchange} · tick ${inst.tick_size} = ${fmtMoney(
            inst.tick_value
          )} · point ${fmtMoney(inst.point_value)}`
        : "";
    }

    function readDraft() {
      const fd = new FormData(form);
      return {
        account_id: Number(fd.get("account_id")) || null,
        instrument: fd.get("instrument") || null,
        direction: fd.get("direction") || null,
        entry_price: numOrNull(fd.get("entry_price")),
        stop_price: numOrNull(fd.get("stop_price")),
        target_price: numOrNull(fd.get("target_price")),
        contracts: intOrNull(fd.get("contracts")),
        thesis: (fd.get("thesis") || "").trim() || null,
      };
    }

    function updatePreview() {
      const draft = readDraft();
      const inst = currentInstrument();
      const risk = tradeRisk(draft, inst);
      const rr = plannedRR(draft);
      const reward = risk && rr ? risk.dollars * rr : null;

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
      cells.push(`
        <div class="stat">
          <div class="stat-label">Planned R:R</div>
          <div class="stat-value">${rr ? rr.toFixed(2) : "—"}</div>
        </div>
      `);
      cells.push(`
        <div class="stat">
          <div class="stat-label">Reward at target</div>
          <div class="stat-value">${reward ? fmtMoney(reward) : "—"}</div>
        </div>
      `);
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
      const err = validatePlanShape(draft);
      if (err) {
        errEl.textContent = err;
        return;
      }
      try {
        if (isEdit) {
          await updatePlan(plan.id, draft);
          location.hash = `#/plans/${plan.id}`;
        } else {
          const id = await createPlan(draft);
          location.hash = `#/plans/${id}`;
        }
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
  return new URLSearchParams(hash.slice(q + 1)).get(name);
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
