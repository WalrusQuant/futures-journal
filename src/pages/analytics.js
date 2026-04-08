import { listTrades } from "../lib/trades.js";
import {
  listAccounts,
  ACCOUNT_CATEGORIES,
  categoryDef,
} from "../lib/accounts.js";
import { REAL_CATEGORIES, SIM_CATEGORIES } from "../lib/ledger.js";
import { listInstruments } from "../lib/instruments.js";
import {
  summarizeTrades,
  equityCurve,
  groupByInstrument,
  groupByTag,
  rDistribution,
  groupByPlannedStatus,
  groupByAccount,
  groupByHourOfDay,
  groupByDayOfWeek,
  computeStreaks,
  reviewCoverage,
} from "../lib/analytics.js";
import { lineChart, barChart } from "../components/charts.js";
import { fmtMoney, fmtNumber, esc } from "../lib/format.js";
import { attachSort } from "../lib/table-sort.js";

export async function render() {
  const accounts = await listAccounts({ includeArchived: true });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const instruments = await listInstruments();
  const filters = readFilters();
  const trades = await listTrades(filters);

  // Post-filters (applied in JS because we need account metadata that
  // listTrades doesn't join on): view mode, category multi-select, and
  // the include-archived toggle.
  //
  // Default behavior: archived accounts are hidden unless the user
  // explicitly opts in or has selected a specific archived account by
  // id. Failed combines shouldn't drag down active performance.
  const applyPostFilters = (tradeSet) => {
    let out = tradeSet;
    if (!filters.includeArchived && !filters.account_id) {
      out = out.filter(
        (t) => accountById.get(t.account_id)?.is_active !== 0
      );
    }
    if (filters.view === "real") {
      out = out.filter((t) => {
        const a = accountById.get(t.account_id);
        return a && REAL_CATEGORIES.has(a.category);
      });
    } else if (filters.view === "sim") {
      out = out.filter((t) => {
        const a = accountById.get(t.account_id);
        return a && SIM_CATEGORIES.has(a.category);
      });
    }
    if (filters.categories && filters.categories.size > 0) {
      out = out.filter((t) => {
        const a = accountById.get(t.account_id);
        return a && filters.categories.has(a.category);
      });
    }
    return out;
  };

  const scopedTrades = applyPostFilters(trades);
  const closed = scopedTrades.filter((t) => t.status === "closed");

  // The planned-vs-unplanned comparison exists specifically to see both
  // groups side by side, so it must not be affected by the planned filter
  // chip itself. Re-fetch with the same account/instrument/date filters
  // but without the `planned` chip applied.
  const filtersForSplit = { ...filters };
  delete filtersForSplit.planned;
  const splitTrades = filters.planned
    ? applyPostFilters(await listTrades(filtersForSplit))
    : scopedTrades;
  const plannedSplit = groupByPlannedStatus(
    splitTrades.filter((t) => t.status === "closed")
  );

  const stats = summarizeTrades(closed);
  const eq = equityCurve(closed);
  const byInstrument = groupByInstrument(closed);
  const byAccount = groupByAccount(closed);
  const byTag = groupByTag(closed);
  const byHour = groupByHourOfDay(closed);
  const byDow = groupByDayOfWeek(closed);
  const streaks = computeStreaks(closed);
  const coverage = reviewCoverage(closed);
  const rDist = rDistribution(closed);

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
        }>${esc(i.symbol)}</option>`
    )
    .join("")}`;

  const filterCount = countActiveFilters(filters);
  const filtersActive = filterCount > 0;

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Performance</div>
        <h1>Analytics</h1>
      </div>
    </div>

    <div class="filter-bar" style="gap:var(--sp-2);margin-bottom:var(--sp-2)">
      ${renderViewPills(filters.view)}
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
        <label>Planned</label>
        <select name="planned">
          <option value=""${!filters.planned ? " selected" : ""}>All</option>
          <option value="planned"${filters.planned === "planned" ? " selected" : ""}>Planned only</option>
          <option value="unplanned"${filters.planned === "unplanned" ? " selected" : ""}>Unplanned only</option>
        </select>
      </div>
      <div class="form-row">
        <label>Categories</label>
        <div class="radio-group">
          ${ACCOUNT_CATEGORIES.map(
            (c) => `
              <label>
                <input type="checkbox" name="categories" value="${esc(c.value)}"${
              filters.categories.has(c.value) ? " checked" : ""
            }>
                ${esc(c.label)}
              </label>
            `
          ).join("")}
        </div>
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
        <label>
          <input type="checkbox" name="archived" value="1"${
            filters.includeArchived ? " checked" : ""
          }>
          Include archived accounts
        </label>
        <div class="help">Failed combines and closed accounts are hidden by default.</div>
      </div>
      <div style="display:flex;gap:var(--sp-2)">
        <button type="submit" class="primary btn-sm">Apply</button>
        <button type="button" class="btn-sm" id="btn-clear">Clear</button>
      </div>
    </form>

    ${
      stats.count === 0
        ? `<div class="card empty-state">
            <h3>No closed trades match</h3>
            <p>${
              filtersActive
                ? "No closed trades match the current filters."
                : "Log some closed trades first to see analytics."
            }</p>
            ${
              filtersActive
                ? `<div class="empty-state-action"><button type="button" class="btn-sm" id="btn-clear-empty">Clear all filters</button></div>`
                : ""
            }
          </div>`
        : `
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-label">Trades</div>
            <div class="stat-value">${stats.count}</div>
            <div class="stat-sub">${stats.wins}W · ${stats.losses}L · ${stats.breakevens}BE</div>
          </div>
          <div class="stat">
            <div class="stat-label">Net P&amp;L</div>
            <div class="stat-value ${pnlClass(stats.totalPnL)}">${fmtMoney(
            stats.totalPnL,
            { signed: true }
          )}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Win rate</div>
            <div class="stat-value">${stats.winRate.toFixed(1)}%</div>
          </div>
          <div class="stat">
            <div class="stat-label">Profit factor</div>
            <div class="stat-value">${
              Number.isFinite(stats.profitFactor)
                ? stats.profitFactor.toFixed(2)
                : "∞"
            }</div>
          </div>
          <div class="stat">
            <div class="stat-label">Avg R</div>
            <div class="stat-value ${pnlClass(stats.avgR)}">${
            (stats.avgR > 0 ? "+" : "") + stats.avgR.toFixed(2)
          }R</div>
          </div>
          <div class="stat">
            <div class="stat-label">Expectancy</div>
            <div class="stat-value ${pnlClass(stats.expectancy)}">${fmtMoney(
            stats.expectancy,
            { signed: true }
          )}</div>
            <div class="stat-sub">per trade</div>
          </div>
          <div class="stat">
            <div class="stat-label">Avg win</div>
            <div class="stat-value profit">${fmtMoney(stats.avgWin)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Avg loss</div>
            <div class="stat-value loss">${fmtMoney(stats.avgLoss)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Best</div>
            <div class="stat-value profit">${fmtMoney(stats.bestTrade)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Worst</div>
            <div class="stat-value loss">${fmtMoney(stats.worstTrade)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Avg hold</div>
            <div class="stat-value">${formatHold(stats.avgHoldHours)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Longest win streak</div>
            <div class="stat-value profit">${streaks.longestWin}</div>
            ${
              streaks.currentDirection === "win" && streaks.currentLength > 0
                ? `<div class="stat-sub">current ${streaks.currentLength}</div>`
                : ""
            }
          </div>
          <div class="stat">
            <div class="stat-label">Longest loss streak</div>
            <div class="stat-value loss">${streaks.longestLoss}</div>
            ${
              streaks.currentDirection === "loss" && streaks.currentLength > 0
                ? `<div class="stat-sub">current ${streaks.currentLength}</div>`
                : ""
            }
          </div>
          <div class="stat">
            <div class="stat-label">Review coverage</div>
            <div class="stat-value ${
              coverage.pct >= 80
                ? "profit"
                : coverage.pct >= 50
                ? ""
                : "loss"
            }">${coverage.pct.toFixed(0)}%</div>
            <div class="stat-sub">${coverage.reviewed} / ${coverage.total}</div>
          </div>
        </div>

        ${renderPlannedSplit(plannedSplit)}

        <div class="section">
          <div class="section-header"><h2>Equity curve</h2></div>
          <div class="card">${lineChart(eq, { height: 240 })}</div>
        </div>

        <div class="section">
          <div class="section-header"><h2>R-multiple distribution</h2></div>
          <div class="card">${barChart(
            rDist.map((b) => ({
              label: b.label,
              value: b.count,
              color: b.label.startsWith("<") || b.label.startsWith("-")
                ? "var(--loss)"
                : "var(--profit)",
            })),
            { height: 220, valueKey: "value", labelKey: "label", colorKey: "color" }
          )}</div>
        </div>

        <div class="section dash-2col">
          <div>
            <div class="section-header"><h2>Day of week</h2></div>
            <div class="card">${barChart(
              byDow.map((d) => ({
                label: d.label,
                value: d.pnl,
              })),
              { height: 220, valueKey: "value", labelKey: "label" }
            )}</div>
          </div>
          <div>
            <div class="section-header"><h2>Hour of day</h2></div>
            <div class="card">${
              byHour.some((h) => h.count > 0)
                ? barChart(
                    byHour.map((h) => ({
                      label: h.label,
                      value: h.pnl,
                    })),
                    { height: 220, valueKey: "value", labelKey: "label" }
                  )
                : `<div class="chart-empty">No data</div>`
            }</div>
          </div>
        </div>

        ${
          byAccount.length > 1
            ? `<div class="section">
                <div class="section-header"><h2>By account</h2></div>
                <div class="card" style="padding:0">
                  <table id="by-account-table">
                    <thead>
                      <tr>
                        <th class="th-sortable" data-sort-key="account_name" data-sort-type="string">Account</th>
                        <th class="num th-sortable" data-sort-key="count" data-sort-type="number">Trades</th>
                        <th class="num th-sortable" data-sort-key="winRate" data-sort-type="number">Win %</th>
                        <th class="num th-sortable" data-sort-key="pnl" data-sort-type="number">P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody>${byAccount.map(renderAccountBreakdownRow).join("")}</tbody>
                  </table>
                </div>
              </div>`
            : ""
        }

        <div class="section dash-2col">
          <div>
            <div class="section-header"><h2>By instrument</h2></div>
            ${
              byInstrument.length === 0
                ? `<div class="card empty-state"><p>No data</p></div>`
                : `<div class="card" style="padding:0">
                    <table id="by-instrument-table">
                      <thead>
                        <tr>
                          <th class="th-sortable" data-sort-key="instrument" data-sort-type="string">Symbol</th>
                          <th class="num th-sortable" data-sort-key="count" data-sort-type="number">Trades</th>
                          <th class="num th-sortable" data-sort-key="winRate" data-sort-type="number">Win %</th>
                          <th class="num th-sortable" data-sort-key="pnl" data-sort-type="number">P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>${byInstrument.map(renderInstrumentBreakdownRow).join("")}</tbody>
                    </table>
                  </div>`
            }
          </div>
          <div>
            <div class="section-header"><h2>By tag</h2></div>
            ${
              byTag.length === 0
                ? `<div class="card empty-state"><p>No tagged trades</p></div>`
                : `<div class="card" style="padding:0">
                    <table id="by-tag-table">
                      <thead>
                        <tr>
                          <th class="th-sortable" data-sort-key="name" data-sort-type="string">Tag</th>
                          <th class="num th-sortable" data-sort-key="count" data-sort-type="number">Trades</th>
                          <th class="num th-sortable" data-sort-key="winRate" data-sort-type="number">Win %</th>
                          <th class="num th-sortable" data-sort-key="expectancy" data-sort-type="number">Expectancy</th>
                          <th class="num th-sortable" data-sort-key="pnl" data-sort-type="number">P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>${byTag.map(renderTagBreakdownRow).join("")}</tbody>
                    </table>
                  </div>`
            }
          </div>
        </div>
        `
    }
  `;

  function mount(pageEl) {
    const form = pageEl.querySelector("#filter-form");
    const submitFromForm = () => {
      const fd = new FormData(form);
      const params = new URLSearchParams();
      for (const k of ["account_id", "instrument", "planned", "from", "to"]) {
        const v = fd.get(k);
        if (v) params.set(k, v);
      }
      const cats = fd.getAll("categories");
      if (cats.length) params.set("categories", cats.join(","));
      if (fd.get("archived")) params.set("archived", "1");
      if (filters.view && filters.view !== "all") params.set("view", filters.view);
      location.hash = "#/analytics" + (params.toString() ? "?" + params : "");
    };
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitFromForm();
    });
    // Auto-apply on any field change — no Apply click required.
    form?.addEventListener("change", submitFromForm);

    const clearAll = () => {
      location.hash = "#/analytics";
    };
    pageEl.querySelector("#btn-clear")?.addEventListener("click", clearAll);
    pageEl
      .querySelector("#btn-clear-summary")
      ?.addEventListener("click", clearAll);
    pageEl
      .querySelector("#btn-clear-empty")
      ?.addEventListener("click", clearAll);

    pageEl.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hash = location.hash;
        const qIdx = hash.indexOf("?");
        const sp = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : "");
        const v = btn.dataset.view;
        if (v === "all") sp.delete("view");
        else sp.set("view", v);
        location.hash =
          "#/analytics" + (sp.toString() ? "?" + sp.toString() : "");
      });
    });

    // Sort the three breakdown tables (local sort, no hash persistence).
    const byAcctEl = pageEl.querySelector("#by-account-table");
    if (byAcctEl) {
      attachSort(byAcctEl, {
        rows: byAccount,
        renderRow: renderAccountBreakdownRow,
        defaultKey: "pnl",
        defaultDir: "desc",
      });
    }
    const byInstEl = pageEl.querySelector("#by-instrument-table");
    if (byInstEl) {
      attachSort(byInstEl, {
        rows: byInstrument,
        renderRow: renderInstrumentBreakdownRow,
        defaultKey: "pnl",
        defaultDir: "desc",
      });
    }
    const byTagEl = pageEl.querySelector("#by-tag-table");
    if (byTagEl) {
      attachSort(byTagEl, {
        rows: byTag,
        renderRow: renderTagBreakdownRow,
        defaultKey: "pnl",
        defaultDir: "desc",
      });
    }
  }

  return { html, mount };
}

function renderViewPills(current) {
  const pills = [
    { key: "all",  label: "All activity" },
    { key: "real", label: "Real money" },
    { key: "sim",  label: "Simulated" },
  ];
  return pills
    .map(
      (p) => `
        <button class="pill${current === p.key ? " pill-active" : ""}"
                data-view="${p.key}">${p.label}</button>
      `
    )
    .join("");
}

function countActiveFilters(f) {
  let n = 0;
  if (f.account_id) n++;
  if (f.instrument) n++;
  if (f.planned) n++;
  if (f.fromDate) n++;
  if (f.toDate) n++;
  if (f.categories && f.categories.size > 0) n++;
  if (f.includeArchived) n++;
  if (f.view && f.view !== "all") n++;
  return n;
}

function renderAccountBreakdownRow(a) {
  return `
    <tr>
      <td><strong>${esc(a.account_name)}</strong></td>
      <td class="num">${a.count}</td>
      <td class="num">${a.winRate.toFixed(0)}%</td>
      <td class="num ${pnlClass(a.pnl)}">${fmtMoney(a.pnl, { signed: true })}</td>
    </tr>`;
}

function renderInstrumentBreakdownRow(i) {
  return `
    <tr>
      <td><strong>${esc(i.instrument)}</strong></td>
      <td class="num">${i.count}</td>
      <td class="num">${i.winRate.toFixed(0)}%</td>
      <td class="num ${pnlClass(i.pnl)}">${fmtMoney(i.pnl, { signed: true })}</td>
    </tr>`;
}

function renderTagBreakdownRow(t) {
  return `
    <tr>
      <td><span class="tag-static" style="--tag-color:${esc(t.color)}">${esc(t.name)}</span></td>
      <td class="num">${t.count}</td>
      <td class="num">${t.winRate.toFixed(0)}%</td>
      <td class="num ${pnlClass(t.expectancy)}">${fmtMoney(t.expectancy, { signed: true })}</td>
      <td class="num ${pnlClass(t.pnl)}">${fmtMoney(t.pnl, { signed: true })}</td>
    </tr>`;
}

function readFilters() {
  const hash = location.hash;
  const qIdx = hash.indexOf("?");
  const out = { view: "all", categories: new Set(), includeArchived: false };
  if (qIdx < 0) return out;
  const sp = new URLSearchParams(hash.slice(qIdx + 1));
  if (sp.get("account_id")) out.account_id = Number(sp.get("account_id"));
  if (sp.get("instrument")) out.instrument = sp.get("instrument");
  const planned = sp.get("planned");
  if (planned === "planned" || planned === "unplanned") out.planned = planned;
  if (sp.get("from")) {
    out.fromDate = sp.get("from");
    out.from = new Date(sp.get("from") + "T00:00:00").toISOString();
  }
  if (sp.get("to")) {
    out.toDate = sp.get("to");
    out.to = new Date(sp.get("to") + "T23:59:59").toISOString();
  }
  const view = sp.get("view");
  if (view === "real" || view === "sim" || view === "all") out.view = view;
  const cats = sp.get("categories");
  if (cats) {
    out.categories = new Set(
      cats.split(",").filter((c) =>
        ACCOUNT_CATEGORIES.some((def) => def.value === c)
      )
    );
  }
  if (sp.get("archived") === "1") out.includeArchived = true;
  return out;
}

// Side-by-side comparison of planned vs unplanned trades. Only rendered
// when there's at least one of each — a single-sided split is useless and
// would just add noise.
function renderPlannedSplit(split) {
  const hasBoth = split.planned.count > 0 && split.unplanned.count > 0;
  if (!hasBoth) return "";
  const col = (label, s, tone) => `
    <div class="card planned-split-col">
      <div class="planned-split-head">
        <strong>${label}</strong>
        <span class="dim">${s.count} trade${s.count === 1 ? "" : "s"}</span>
      </div>
      <div class="planned-split-grid">
        <div>
          <span class="dim">Net P&amp;L</span>
          <strong class="${pnlClass(s.totalPnL)}">${fmtMoney(s.totalPnL, {
    signed: true,
  })}</strong>
        </div>
        <div>
          <span class="dim">Win rate</span>
          <strong>${s.winRate.toFixed(0)}%</strong>
        </div>
        <div>
          <span class="dim">Avg R</span>
          <strong class="${pnlClass(s.avgR)}">${
    (s.avgR > 0 ? "+" : "") + s.avgR.toFixed(2)
  }R</strong>
        </div>
        <div>
          <span class="dim">Expectancy</span>
          <strong class="${pnlClass(s.expectancy)}">${fmtMoney(s.expectancy, {
    signed: true,
  })}</strong>
        </div>
        <div>
          <span class="dim">Profit factor</span>
          <strong>${
            Number.isFinite(s.profitFactor)
              ? s.profitFactor.toFixed(2)
              : "∞"
          }</strong>
        </div>
      </div>
    </div>
  `;
  // Verdict line: which side has the higher expectancy per trade?
  const planWin = split.planned.expectancy >= split.unplanned.expectancy;
  const diff = Math.abs(
    split.planned.expectancy - split.unplanned.expectancy
  );
  const verdict = `
    <div class="planned-split-verdict ${planWin ? "profit" : "loss"}">
      ${
        planWin
          ? `Planned trades are earning ${fmtMoney(diff)} more per trade than unplanned.`
          : `Unplanned trades are currently beating planned by ${fmtMoney(diff)} per trade.`
      }
    </div>
  `;
  return `
    <div class="section">
      <div class="section-header"><h2>Planned vs unplanned</h2></div>
      <div class="planned-split">
        ${col("Planned", split.planned)}
        ${col("Unplanned", split.unplanned)}
      </div>
      ${verdict}
    </div>
  `;
}

function pnlClass(n) {
  if (n == null) return "dim";
  if (n > 0) return "profit";
  if (n < 0) return "loss";
  return "";
}

function formatHold(hours) {
  if (!hours || hours < 0.01) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
