import { listAccounts, computeHeadroom } from "../lib/accounts.js";
import { listTrades } from "../lib/trades.js";
import { listPlans } from "../lib/plans.js";
import {
  summarizeTrades,
  equityCurve,
  dayBounds,
  weekBounds,
  monthBounds,
} from "../lib/analytics.js";
import { lineChart } from "../components/charts.js";
import { fmtMoney, fmtDateTime, esc } from "../lib/format.js";
import { getSetting, SETTING_KEYS } from "../lib/settings.js";

export async function render() {
  const accounts = await listAccounts({ includeArchived: false });
  const allTrades = await listTrades({});
  const openTrades = allTrades.filter((t) => t.status === "open");
  const closedTrades = allTrades.filter((t) => t.status === "closed");

  const weekStart = Number(await getSetting(SETTING_KEYS.weekStart, "0"));

  const today = dayBounds();
  const week = weekBounds(new Date(), weekStart);
  const month = monthBounds();

  const inRange = (t, b) => {
    if (!t.exit_time) return false;
    const x = new Date(t.exit_time).getTime();
    return x >= b.start.getTime() && x <= b.end.getTime();
  };

  const todayTrades = closedTrades.filter((t) => inRange(t, today));
  const weekTrades = closedTrades.filter((t) => inRange(t, week));
  const monthTrades = closedTrades.filter((t) => inRange(t, month));

  const sumPnL = (arr) => arr.reduce((s, t) => s + (t.pnl_dollars || 0), 0);
  const todayPnL = sumPnL(todayTrades);
  const weekPnL = sumPnL(weekTrades);
  const monthPnL = sumPnL(monthTrades);

  const recent = closedTrades.slice(0, 5);
  const activePlans = (await listPlans({ status: "active" })).slice(0, 5);

  // Account headroom warnings (funded only, < $750 from trailing DD floor)
  const warnings = accounts
    .filter((a) => a.type === "funded" && a.trailing_dd != null)
    .map((a) => ({ a, hr: computeHeadroom(a) }))
    .filter(({ hr }) => hr.trailingRoom != null && hr.trailingRoom < 750);

  // Equity curve over all closed trades.
  const eq = equityCurve(closedTrades);

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Overview</div>
        <h1>Dashboard</h1>
      </div>
    </div>

    ${
      warnings.length
        ? `<div class="card warn-card">
            <strong>⚠ Drawdown warning</strong>
            <ul style="margin:var(--sp-2) 0 0;padding-left:var(--sp-4)">
              ${warnings
                .map(
                  ({ a, hr }) =>
                    `<li>${esc(a.name)} — only ${fmtMoney(
                      hr.trailingRoom
                    )} from trailing drawdown floor</li>`
                )
                .join("")}
            </ul>
          </div>`
        : ""
    }

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Today</div>
        <div class="stat-value ${pnlClass(todayPnL)}">${fmtMoney(todayPnL, {
    signed: true,
  })}</div>
        <div class="stat-sub">${todayTrades.length} trade${
    todayTrades.length === 1 ? "" : "s"
  }</div>
      </div>
      <div class="stat">
        <div class="stat-label">This week</div>
        <div class="stat-value ${pnlClass(weekPnL)}">${fmtMoney(weekPnL, {
    signed: true,
  })}</div>
        <div class="stat-sub">${weekTrades.length} trade${
    weekTrades.length === 1 ? "" : "s"
  }</div>
      </div>
      <div class="stat">
        <div class="stat-label">This month</div>
        <div class="stat-value ${pnlClass(monthPnL)}">${fmtMoney(monthPnL, {
    signed: true,
  })}</div>
        <div class="stat-sub">${monthTrades.length} trade${
    monthTrades.length === 1 ? "" : "s"
  }</div>
      </div>
      <div class="stat">
        <div class="stat-label">Open positions</div>
        <div class="stat-value">${openTrades.length}</div>
        <div class="stat-sub">${accounts.length} active account${
    accounts.length === 1 ? "" : "s"
  }</div>
      </div>
    </div>

    ${
      eq.length > 1
        ? `<div class="section">
            <div class="section-header"><h2>Equity curve</h2><a class="btn-link" href="#/analytics">Analytics →</a></div>
            <div class="card">${lineChart(eq, { height: 220 })}</div>
          </div>`
        : ""
    }

    <div class="section dash-2col">
      <div>
        <div class="section-header"><h2>Recent trades</h2><a class="btn-link" href="#/trades">All →</a></div>
        ${
          recent.length === 0
            ? `<div class="card empty-state"><p>No closed trades yet.</p></div>`
            : `<div class="card" style="padding:0">
                <table>
                  <tbody>
                    ${recent
                      .map(
                        (t) => `
                        <tr class="clickable" data-trade-id="${t.id}">
                          <td><strong>${esc(t.instrument)}</strong>
                            <span class="badge ${t.direction}" style="margin-left:6px">${t.direction}</span>
                          </td>
                          <td class="muted">${fmtDateTime(t.exit_time || t.entry_time)}</td>
                          <td class="num ${pnlClass(t.pnl_dollars)}">${fmtMoney(
                          t.pnl_dollars || 0,
                          { signed: true }
                        )}</td>
                          <td class="num ${pnlClass(t.r_multiple)}">${
                          t.r_multiple != null
                            ? (t.r_multiple > 0 ? "+" : "") + t.r_multiple.toFixed(2) + "R"
                            : "—"
                        }</td>
                        </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
        }
      </div>
      <div>
        <div class="section-header"><h2>Active plans</h2><a class="btn-link" href="#/plans">All →</a></div>
        ${
          activePlans.length === 0
            ? `<div class="card empty-state"><p>No active plans.</p></div>`
            : `<div class="card" style="padding:0">
                <table>
                  <tbody>
                    ${activePlans
                      .map(
                        (p) => `
                        <tr class="clickable" data-plan-id="${p.id}">
                          <td><strong>${esc(p.instrument)}</strong>
                            <span class="badge ${p.direction}" style="margin-left:6px">${p.direction}</span>
                          </td>
                          <td class="muted">@ ${p.entry_price}</td>
                          <td class="num">${(p.rr_planned || 0).toFixed(2)}R</td>
                        </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    </div>

    <div class="section">
      <div class="section-header"><h2>Accounts</h2><a class="btn-link" href="#/accounts">Manage →</a></div>
      ${
        accounts.length === 0
          ? `<div class="card empty-state">
              <h3>No accounts yet</h3>
              <p>Add your first funded prop or cash brokerage account at <a href="#/accounts">Accounts</a>.</p>
            </div>`
          : `<div class="card" style="padding:0">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th class="num">Balance</th>
                    <th class="num">P&amp;L</th>
                    <th class="num">Headroom</th>
                  </tr>
                </thead>
                <tbody>${accounts.map(accountRow).join("")}</tbody>
              </table>
            </div>`
      }
    </div>
  `;

  function mount(pageEl) {
    pageEl.querySelectorAll("[data-trade-id]").forEach((tr) => {
      tr.addEventListener(
        "click",
        () => (location.hash = `#/trades/${tr.dataset.tradeId}`)
      );
    });
    pageEl.querySelectorAll("[data-plan-id]").forEach((tr) => {
      tr.addEventListener(
        "click",
        () => (location.hash = `#/plans/${tr.dataset.planId}`)
      );
    });
    pageEl.querySelectorAll("tr.clickable[data-account-id]").forEach((tr) => {
      tr.addEventListener(
        "click",
        () => (location.hash = `#/accounts/${tr.dataset.accountId}`)
      );
    });
  }

  return { html, mount };
}

function pnlClass(n) {
  if (n == null) return "dim";
  if (n > 0) return "profit";
  if (n < 0) return "loss";
  return "";
}

function accountRow(a) {
  const pnl = a.current_balance - a.account_size;
  const hr = computeHeadroom(a);
  let headroomCell = `<span class="dim">—</span>`;
  if (a.type === "funded" && hr.trailingRoom != null) {
    const cls =
      hr.trailingRoom < 500 ? "loss" : hr.trailingRoom < 1500 ? "" : "profit";
    headroomCell = `<span class="${cls}">${fmtMoney(hr.trailingRoom)}</span>`;
  }
  return `
    <tr class="clickable" data-account-id="${a.id}">
      <td><strong>${esc(a.name)}</strong>
        <div class="muted" style="font-size:var(--fs-xs)">${esc(
          a.type === "funded" ? a.prop_firm || "" : a.broker || ""
        )}</div>
      </td>
      <td><span class="badge ${a.type}">${a.type}</span></td>
      <td class="num">${fmtMoney(a.current_balance)}</td>
      <td class="num ${pnlClass(pnl)}">${fmtMoney(pnl, { signed: true })}</td>
      <td class="num">${headroomCell}</td>
    </tr>
  `;
}
