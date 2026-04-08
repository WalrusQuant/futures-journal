import { listAccounts, computeHeadroom } from "../lib/accounts.js";
import {
  listTrades,
  listTradesNeedingReview,
  countTradesNeedingReview,
} from "../lib/trades.js";
import { listPlans, countPlansByStatus } from "../lib/plans.js";
import { dailyPnl, openTradesWithRisk, summarizeOpen } from "../lib/risk.js";
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

  // Today panel: one card per active account. Cards adapt to whatever rules
  // that account has configured (daily loss limit, trailing drawdown,
  // max contracts). Every active account gets a card — safety panel should
  // err toward showing more, not less.
  const needsReviewCount = await countTradesNeedingReview();
  const planCounts = await countPlansByStatus();
  const activePlansCount = planCounts.active || 0;

  const todayCards = await Promise.all(
    accounts.map(async (a) => {
      const [dpnl, openEntries] = await Promise.all([
        dailyPnl(a.id),
        openTradesWithRisk(a.id),
      ]);
      const { riskDollars: openRisk, contracts: openContracts } =
        summarizeOpen(openEntries);
      return {
        account: a,
        dpnl,
        openRisk,
        openContracts,
        headroom: computeHeadroom(a),
      };
    })
  );

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

    ${renderTodayPanel(todayCards, { needsReviewCount, activePlansCount })}

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

// Today panel: one card per active account. Every card shows today's
// realized P&L and current open risk. Configured rules (daily loss limit,
// trailing drawdown floor, max contracts) each get their own line on the
// card. Accounts with no rules configured still get a card so you can see
// the day at a glance.
function renderTodayPanel(
  todayCards,
  { needsReviewCount = 0, activePlansCount = 0 } = {}
) {
  if (!todayCards.length && !needsReviewCount && !activePlansCount) return "";
  const accountCards = todayCards.map(renderTodayCard).join("");
  return `
    <div class="section today-panel">
      <div class="section-header"><h2>Today</h2></div>
      ${
        activePlansCount > 0
          ? renderTodayBanner({
              href: "#/plans",
              title: "Active plans",
              desc: "waiting to be taken",
              count: activePlansCount,
              unit: `plan${activePlansCount === 1 ? "" : "s"}`,
              tone: "accent",
            })
          : ""
      }
      ${
        needsReviewCount > 0
          ? renderTodayBanner({
              href: "#/trades?needs_review=1",
              title: "Needs review",
              desc: "closed trades waiting for a post-trade review",
              count: needsReviewCount,
              unit: `trade${needsReviewCount === 1 ? "" : "s"}`,
              tone: "warn",
            })
          : ""
      }
      ${accountCards ? `<div class="today-grid">${accountCards}</div>` : ""}
    </div>
  `;
}

// Full-width banner row used for dashboard call-to-action items that sit
// above the per-account Today grid. Keeps them compact and visually
// distinct from the account cards.
function renderTodayBanner({ href, title, desc, count, unit, tone }) {
  return `
    <a href="${href}" class="card today-review-banner today-banner-${tone}">
      <div>
        <strong>${esc(title)}</strong>
        <span class="dim"> — ${esc(desc)}</span>
      </div>
      <div class="today-review-banner-count">
        <span class="${tone}">${count}</span>
        <span class="dim" style="font-size:var(--fs-sm)"> ${esc(unit)} →</span>
      </div>
    </a>
  `;
}

function renderTodayCard({ account: a, dpnl, openRisk, openContracts, headroom }) {
  const rows = [];

  // Daily loss limit bar (if configured).
  if (a.daily_loss_limit != null && a.daily_loss_limit > 0) {
    const dll = a.daily_loss_limit;
    const usedNow = Math.max(0, -dpnl) + openRisk;
    rows.push(
      renderRuleBar({
        label: "Daily loss limit",
        used: usedNow,
        limit: dll,
        formatter: fmtMoney,
      })
    );
  }

  // Trailing drawdown: displayed as a simple stat line, not a bar. A bar
  // doesn't work here because once balance > start + dd, "room" exceeds
  // the allowance and the progress-bar mental model breaks. Better to show
  // "room until floor" directly and color it by how tight it is.
  if (a.type === "funded" && a.trailing_dd != null && headroom.trailingRoom != null) {
    const roomAfterOpen = headroom.trailingRoom - openRisk;
    const tone =
      roomAfterOpen < 250
        ? "loss"
        : roomAfterOpen < 750
        ? "warn"
        : "";
    rows.push(`
      <div class="today-rule today-rule-stat">
        <span class="dim">Trailing DD room</span>
        <strong class="${tone}">${fmtMoney(Math.max(0, roomAfterOpen))}</strong>
        <span class="dim" style="font-size:var(--fs-xs)">allowance ${fmtMoney(a.trailing_dd)}</span>
      </div>
    `);
  }

  // Max contracts (if configured).
  if (a.max_contracts != null && a.max_contracts > 0) {
    rows.push(
      renderRuleBar({
        label: "Open contracts",
        used: openContracts,
        limit: a.max_contracts,
        formatter: (n) => String(n),
      })
    );
  }

  // Profit target (funded accounts only, if configured).
  if (a.type === "funded" && headroom.profitToTarget != null) {
    const target = a.profit_target;
    const progress = target - headroom.profitToTarget; // balance delta vs start
    const clamped = Math.max(0, Math.min(progress, target));
    rows.push(
      renderRuleBar({
        label: "Profit target",
        used: clamped,
        limit: target,
        formatter: fmtMoney,
        // Profit targets are "want higher" — invert the tone logic via
        // the inverted flag so more filled = green, not red.
        inverted: true,
      })
    );
  }

  // Summary line: today + open risk, always shown.
  const dpnlClass = dpnl > 0 ? "profit" : dpnl < 0 ? "loss" : "dim";
  const summary = `
    <div class="today-card-summary">
      <div>
        <span class="dim">Today</span>
        <strong class="${dpnlClass}">${fmtMoney(dpnl, { signed: true })}</strong>
      </div>
      <div>
        <span class="dim">Open risk</span>
        <strong>${fmtMoney(openRisk)}</strong>
        <span class="dim">(${openContracts} ct)</span>
      </div>
    </div>
  `;

  const hasRules = rows.length > 0;
  const rulesBlock = hasRules
    ? `<div class="today-card-rules">${rows.join("")}</div>`
    : `<div class="dim" style="font-size:var(--fs-xs);margin-top:var(--sp-2)">No risk rules configured.</div>`;

  return `
    <div class="card today-card">
      <div class="today-card-head">
        <strong>${esc(a.name)}</strong>
        <span class="dim">${esc(a.type)}</span>
      </div>
      ${summary}
      ${rulesBlock}
    </div>
  `;
}

// Reusable one-line rule indicator: label on the left, used/limit on the
// right, a thin bar underneath. inverted=true means filling is good (e.g.
// profit target) and the tone scale runs in the opposite direction.
function renderRuleBar({ label, used, limit, formatter, footer, inverted = false }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const over = used > limit;
  let barColor;
  if (inverted) {
    barColor =
      pct >= 100 ? "var(--profit)" : pct > 50 ? "var(--profit)" : "var(--border-bold)";
  } else {
    barColor = over
      ? "var(--loss)"
      : pct > 80
      ? "var(--warn)"
      : pct > 50
      ? "var(--warn)"
      : "var(--profit)";
  }
  const valueClass = inverted ? "" : over ? "loss" : "";
  return `
    <div class="today-rule">
      <div class="today-rule-head">
        <span class="dim">${esc(label)}</span>
        <span class="${valueClass}">${formatter(used)} <span class="dim">of ${formatter(limit)}</span></span>
      </div>
      <div class="today-rule-bar">
        <div style="width:${pct}%;background:${barColor}"></div>
      </div>
      ${footer ? `<div class="dim" style="font-size:var(--fs-xs);margin-top:2px">${esc(footer)}</div>` : ""}
    </div>
  `;
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
