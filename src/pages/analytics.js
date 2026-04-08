import { listTrades } from "../lib/trades.js";
import { listAccounts } from "../lib/accounts.js";
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

export async function render() {
  const accounts = await listAccounts({ includeArchived: true });
  const instruments = await listInstruments();
  const filters = readFilters();
  const trades = await listTrades(filters);
  const closed = trades.filter((t) => t.status === "closed");

  // The planned-vs-unplanned comparison exists specifically to see both
  // groups side by side, so it must not be affected by the planned filter
  // chip itself. Re-fetch with the same account/instrument/date filters
  // but without the `planned` chip applied.
  const filtersForSplit = { ...filters };
  delete filtersForSplit.planned;
  const splitTrades = filters.planned
    ? await listTrades(filtersForSplit)
    : trades;
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

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Performance</div>
        <h1>Analytics</h1>
      </div>
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
        <label>Planned</label>
        <select name="planned">
          <option value=""${!filters.planned ? " selected" : ""}>All</option>
          <option value="planned"${filters.planned === "planned" ? " selected" : ""}>Planned only</option>
          <option value="unplanned"${filters.planned === "unplanned" ? " selected" : ""}>Unplanned only</option>
        </select>
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
      stats.count === 0
        ? `<div class="card empty-state">
            <h3>No closed trades match</h3>
            <p>Try clearing filters or log some closed trades first.</p>
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
                  <table>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th class="num">Trades</th>
                        <th class="num">Win %</th>
                        <th class="num">P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${byAccount
                        .map(
                          (a) => `
                          <tr>
                            <td><strong>${esc(a.account_name)}</strong></td>
                            <td class="num">${a.count}</td>
                            <td class="num">${a.winRate.toFixed(0)}%</td>
                            <td class="num ${pnlClass(a.pnl)}">${fmtMoney(
                            a.pnl,
                            { signed: true }
                          )}</td>
                          </tr>`
                        )
                        .join("")}
                    </tbody>
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
                    <table>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th class="num">Trades</th>
                          <th class="num">Win %</th>
                          <th class="num">P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${byInstrument
                          .map(
                            (i) => `
                            <tr>
                              <td><strong>${esc(i.instrument)}</strong></td>
                              <td class="num">${i.count}</td>
                              <td class="num">${i.winRate.toFixed(0)}%</td>
                              <td class="num ${pnlClass(i.pnl)}">${fmtMoney(
                              i.pnl,
                              { signed: true }
                            )}</td>
                            </tr>`
                          )
                          .join("")}
                      </tbody>
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
                    <table>
                      <thead>
                        <tr>
                          <th>Tag</th>
                          <th class="num">Trades</th>
                          <th class="num">Win %</th>
                          <th class="num">Expectancy</th>
                          <th class="num">P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${byTag
                          .map(
                            (t) => `
                            <tr>
                              <td><span class="tag-static" style="--tag-color:${esc(
                                t.color
                              )}">${esc(t.name)}</span></td>
                              <td class="num">${t.count}</td>
                              <td class="num">${t.winRate.toFixed(0)}%</td>
                              <td class="num ${pnlClass(t.expectancy)}">${fmtMoney(
                              t.expectancy,
                              { signed: true }
                            )}</td>
                              <td class="num ${pnlClass(t.pnl)}">${fmtMoney(
                              t.pnl,
                              { signed: true }
                            )}</td>
                            </tr>`
                          )
                          .join("")}
                      </tbody>
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
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const params = new URLSearchParams();
      for (const k of ["account_id", "instrument", "planned", "from", "to"]) {
        const v = fd.get(k);
        if (v) params.set(k, v);
      }
      location.hash = "#/analytics" + (params.toString() ? "?" + params : "");
    });
    pageEl.querySelector("#btn-clear")?.addEventListener("click", () => {
      location.hash = "#/analytics";
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
