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
import { mountTagPicker } from "../components/tag-picker.js";
import { confirmDialog } from "../components/modal.js";
import { listTags, getPlanTags, setPlanTags } from "../lib/tags.js";
import { getSetting, SETTING_KEYS } from "../lib/settings.js";
import { refreshPage } from "../main.js";
import { attachSort } from "../lib/table-sort.js";
import { attachValidator } from "../lib/form-validate.js";

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
            <table id="plans-table">
              <thead>
                <tr>
                  <th class="th-sortable" data-sort-key="created_at" data-sort-type="date">Created</th>
                  <th class="th-sortable" data-sort-key="account_name" data-sort-type="string">Account</th>
                  <th class="th-sortable" data-sort-key="instrument" data-sort-type="string">Symbol</th>
                  <th class="th-sortable" data-sort-key="direction" data-sort-type="string">Side</th>
                  <th class="num th-sortable" data-sort-key="contracts" data-sort-type="number">Qty</th>
                  <th class="num th-sortable" data-sort-key="entry_price" data-sort-type="number">Entry</th>
                  <th class="num th-sortable" data-sort-key="stop_price" data-sort-type="number">Stop</th>
                  <th class="num th-sortable" data-sort-key="target_price" data-sort-type="number">Target</th>
                  <th class="num th-sortable" data-sort-key="rr_planned" data-sort-type="number">R:R</th>
                  <th class="th-sortable" data-sort-key="status" data-sort-type="string">Status</th>
                </tr>
              </thead>
              <tbody>${plans.map(rowHtml).join("")}</tbody>
            </table>
          </div>`
    }
  `;

  function mount(pageEl) {
    const tableEl = pageEl.querySelector("#plans-table");
    if (tableEl) {
      const bindRowClicks = () => {
        tableEl.querySelectorAll("tr.clickable").forEach((tr) => {
          tr.addEventListener("click", () => {
            location.hash = `#/plans/${tr.dataset.id}`;
          });
        });
      };
      attachSort(tableEl, {
        rows: plans,
        renderRow: rowHtml,
        onChange: bindRowClicks,
      });
      bindRowClicks();
    }
  }

  return { html, mount };
}

function rowHtml(p) {
  return `
    <tr class="clickable" data-id="${p.id}">
      <td>${fmtDate(p.created_at)}</td>
      <td>${esc(p.account_name)}</td>
      <td><strong>${esc(p.instrument)}</strong>
        ${p.tag_names ? `<div class="trade-row-tags">${renderRowTags(p)}</div>` : ""}
      </td>
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

function renderRowTags(p) {
  if (!p.tag_names) return "";
  const names = p.tag_names.split("|");
  const colors = (p.tag_colors || "").split("|");
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
  const plan = await getPlan(id);
  const planTags = plan ? await getPlanTags(id) : [];
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
              ? plan.trade_deleted
                ? ` · <span class="muted">→ Trade #${plan.trade_id} (deleted)</span>`
                : ` · <a href="#/trades/${plan.trade_id}">→ Trade #${plan.trade_id}</a>`
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
          planTags.length
            ? `<div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border)">
                <div class="form-label" style="margin-bottom:var(--sp-2)">Tags</div>
                <div>${planTags
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
        const ok = await confirmDialog({
          title: "Delete plan",
          message: "Delete this plan? This cannot be undone.",
          confirmLabel: "Delete",
          danger: true,
        });
        if (!ok) return;
        await deletePlan(plan.id);
        location.hash = "#/plans";
      });
  }

  return { html, mount };
}

// ---------- FORM ----------

export async function renderForm(params = {}) {
  const isEdit = !!params.id;
  // Bank accounts are ledger-only and can't hold plans.
  const allAccounts = await listAccounts({ includeArchived: false });
  const accounts = allAccounts.filter((a) => a.category !== "bank");
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
    // Caller already filters `accounts` to active, non-bank entries.
    // If the user's stored default is gone, fall through to the first
    // remaining active account.
    const storedDefault = await getSetting(SETTING_KEYS.defaultAccountId);
    let defaultId = accounts[0]?.id ?? null;
    if (storedDefault) {
      const found = accounts.find((a) => a.id === Number(storedDefault));
      if (found) defaultId = found.id;
    }
    plan = {
      account_id: defaultId,
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
              plan.direction === "long" ? "checked" : ""
            }> Long</label>
            <label><input type="radio" name="direction" value="short" ${
              plan.direction === "short" ? "checked" : ""
            }> Short</label>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label>Entry price <span class="req">*</span></label>
            <span class="input-currency"><input type="number" name="entry_price" step="any" required aria-required="true" inputmode="decimal" value="${
              plan.entry_price ?? ""
            }"></span>
            <div class="field-error" data-for="entry_price"></div>
          </div>
          <div class="form-row">
            <label>Contracts <span class="req">*</span></label>
            <input type="number" name="contracts" min="1" step="1" required aria-required="true" inputmode="numeric" value="${
              plan.contracts ?? 1
            }">
            <div class="field-error" data-for="contracts"></div>
          </div>
          <div class="form-row">
            <label>Stop price <span class="req">*</span></label>
            <span class="input-currency"><input type="number" name="stop_price" step="any" required aria-required="true" inputmode="decimal" value="${
              plan.stop_price ?? ""
            }"></span>
            <div class="field-error" data-for="stop_price"></div>
          </div>
          <div class="form-row">
            <label>Target price <span class="req">*</span></label>
            <span class="input-currency"><input type="number" name="target_price" step="any" required aria-required="true" inputmode="decimal" value="${
              plan.target_price ?? ""
            }"></span>
            <div class="field-error" data-for="target_price"></div>
          </div>
        </div>
      </div>

      <div class="preview" id="preview"></div>

      <div class="card">
        <div class="form-row">
          <label>Tags <span class="opt">optional</span></label>
          <div id="tag-picker-mount"></div>
        </div>
        <div class="form-row">
          <label>Thesis <span class="opt">optional</span></label>
          <textarea name="thesis" placeholder="Why this trade? Key levels, context, what would invalidate it.">${esc(
            plan.thesis || ""
          )}</textarea>
        </div>
      </div>

      <div class="section" id="image-section"></div>

      <div class="form-error"></div>
      <div class="form-actions">
        <a href="#${isEdit ? "/plans/" + plan.id : "/plans"}"><button type="button">Cancel</button></a>
        <button type="submit" class="primary">${
          isEdit ? "Save changes" : "Create plan"
        }</button>
      </div>
    </form>
  `;

  const allTags = await listTags();
  const initialSelectedTagIds = isEdit
    ? (await getPlanTags(plan.id)).map((t) => t.id)
    : [];

  function mount(pageEl) {
    const form = pageEl.querySelector("#plan-form");
    const tickInfo = pageEl.querySelector("#tick-info");
    const previewEl = pageEl.querySelector("#preview");
    const errEl = pageEl.querySelector(".form-error");
    const tagPicker = mountTagPicker(
      pageEl.querySelector("#tag-picker-mount"),
      allTags,
      initialSelectedTagIds
    );

    let galleryHandle = null;
    (async () => {
      galleryHandle = await mountImageGallery(
        pageEl.querySelector("#image-section"),
        isEdit ? { planId: plan.id } : { pending: true }
      );
    })();

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

    // Inline field validation. Stop and target are both required for a plan
    // (an entry without a target isn't a plan, per validatePlanShape).
    const validator = attachValidator(form, {
      account_id: (v) => (!v ? "Account is required." : null),
      instrument: (v) => (!v ? "Instrument is required." : null),
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
        if (!Number.isFinite(d.target_price) || d.target_price <= 0)
          return "Target is required for a plan.";
        if (Number.isFinite(d.entry_price)) {
          if (d.direction === "long" && d.target_price <= d.entry_price)
            return "For a long, target must be above entry.";
          if (d.direction === "short" && d.target_price >= d.entry_price)
            return "For a short, target must be below entry.";
        }
        return null;
      },
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.textContent = "";
      const { ok, firstField } = validator.runAll();
      if (!ok) {
        const el = form.elements[firstField];
        if (el && typeof el.focus === "function") el.focus();
        return;
      }
      const draft = readDraft();
      const err = validatePlanShape(draft);
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
        let savedId;
        if (isEdit) {
          await updatePlan(plan.id, draft);
          savedId = plan.id;
        } else {
          savedId = await createPlan(draft);
        }
        await setPlanTags(savedId, tagPicker.getSelected());
        if (!isEdit && galleryHandle) {
          await galleryHandle.commitPending({ planId: savedId });
        }
        location.hash = `#/plans/${savedId}`;
      } catch (err) {
        console.error(err);
        errEl.textContent = String(err.message || err);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("btn-loading");
        }
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

function priceErr(v, label) {
  const n = Number(v);
  if (v === "" || v == null) return `${label} is required.`;
  if (!Number.isFinite(n) || n <= 0) return `${label} must be a positive number.`;
  return null;
}
