import { listTrades } from "../lib/trades.js";
import { listAccounts } from "../lib/accounts.js";
import { groupByDay, localDateKey } from "../lib/analytics.js";
import { fmtMoney, esc } from "../lib/format.js";
import { getSetting, SETTING_KEYS } from "../lib/settings.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function render() {
  const accounts = await listAccounts({ includeArchived: true });
  const filters = readFilters();
  const monthDate = filters.monthDate;
  const accountId = filters.account_id;
  const weekStart = Number(await getSetting(SETTING_KEYS.weekStart, "0"));
  const WEEKDAYS = weekStart === 1 ? WEEKDAYS_MON : WEEKDAYS_SUN;

  // Range: first to last day of the visible month.
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const tradeFilters = {
    from: monthStart.toISOString(),
    to: monthEnd.toISOString(),
  };
  if (accountId) tradeFilters.account_id = accountId;
  // Trades filter is on entry_time; we want anything that closed in the month
  // too, so we widen and re-filter in JS by exit_time.
  const wideStart = new Date(monthStart);
  wideStart.setDate(wideStart.getDate() - 30);
  tradeFilters.from = wideStart.toISOString();

  const trades = await listTrades(tradeFilters);
  const closedInMonth = trades.filter(
    (t) =>
      t.status === "closed" &&
      t.exit_time &&
      new Date(t.exit_time) >= monthStart &&
      new Date(t.exit_time) <= monthEnd
  );

  const dayMap = groupByDay(closedInMonth);

  const monthPnL = closedInMonth.reduce(
    (s, t) => s + (t.pnl_dollars || 0),
    0
  );
  const monthCount = closedInMonth.length;

  const prevMonth = monthKey(
    new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1)
  );
  const nextMonth = monthKey(
    new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)
  );

  const accountOpts = `<option value="">All accounts</option>${accounts
    .map(
      (a) =>
        `<option value="${a.id}"${
          String(accountId || "") === String(a.id) ? " selected" : ""
        }>${esc(a.name)}</option>`
    )
    .join("")}`;

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Sessions</div>
        <h1>Calendar</h1>
      </div>
    </div>

    <div class="cal-toolbar">
      <div class="cal-nav">
        <a class="btn-sm" href="${monthLink(prevMonth, accountId)}">‹</a>
        <h2>${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}</h2>
        <a class="btn-sm" href="${monthLink(nextMonth, accountId)}">›</a>
        <a class="btn-link" href="${monthLink(monthKey(new Date()), accountId)}" style="margin-left:var(--sp-3)">Today</a>
      </div>
      <form id="acct-form" class="cal-acct">
        <select name="account_id" id="acct-select">${accountOpts}</select>
      </form>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(3, 1fr)">
      <div class="stat">
        <div class="stat-label">Month P&amp;L</div>
        <div class="stat-value ${pnlClass(monthPnL)}">${fmtMoney(monthPnL, {
    signed: true,
  })}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Trades</div>
        <div class="stat-value">${monthCount}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Trading days</div>
        <div class="stat-value">${dayMap.size}</div>
      </div>
    </div>

    ${
      monthCount === 0
        ? `<div class="card empty-state" style="margin-top:var(--sp-4)">
            <p class="muted">No closed trades this month${
              accountId ? " on the selected account" : ""
            }.</p>
          </div>`
        : ""
    }

    <div class="card" style="margin-top:var(--sp-4)">
      <div class="cal-weekdays">
        ${WEEKDAYS.map((w) => `<div>${w}</div>`).join("")}
      </div>
      <div class="cal-grid">
        ${renderGrid(monthDate, dayMap, accountId, weekStart)}
      </div>
    </div>
  `;

  function mount(pageEl) {
    const sel = pageEl.querySelector("#acct-select");
    sel?.addEventListener("change", () => {
      const m = monthKey(monthDate);
      location.hash = monthLink(m, sel.value || null);
    });
  }

  return { html, mount };
}

function renderGrid(monthDate, dayMap, accountId, weekStart = 0) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  // Number of leading blank cells, given the chosen week start.
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const leading = (firstDow - weekStart + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < leading; i++) {
    cells.push(`<div class="cal-cell empty"></div>`);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const key = localDateKey(dateObj.toISOString());
    const data = dayMap.get(key);
    const cls = data
      ? data.pnl > 0
        ? "profit"
        : data.pnl < 0
        ? "loss"
        : "be"
      : "";
    const link = data
      ? `<a class="cal-cell ${cls}" href="${dayLink(key, accountId)}">
          <div class="cal-date">${d}</div>
          <div class="cal-pnl">${fmtMoney(data.pnl, { signed: true })}</div>
          <div class="cal-trades">${data.count} trade${
          data.count === 1 ? "" : "s"
        }</div>
        </a>`
      : `<div class="cal-cell">
          <div class="cal-date">${d}</div>
        </div>`;
    cells.push(link);
  }
  // Pad to a full final week.
  while (cells.length % 7 !== 0) {
    cells.push(`<div class="cal-cell empty"></div>`);
  }
  return cells.join("");
}

function readFilters() {
  const hash = location.hash;
  const qIdx = hash.indexOf("?");
  const sp =
    qIdx >= 0 ? new URLSearchParams(hash.slice(qIdx + 1)) : new URLSearchParams();
  const m = sp.get("m");
  let monthDate;
  if (m) {
    const [y, mm] = m.split("-").map(Number);
    monthDate = new Date(y, mm - 1, 1);
  } else {
    monthDate = new Date();
  }
  const accountId = sp.get("account_id")
    ? Number(sp.get("account_id"))
    : null;
  return { monthDate, account_id: accountId };
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLink(monthKey, accountId) {
  const params = new URLSearchParams();
  params.set("m", monthKey);
  if (accountId) params.set("account_id", String(accountId));
  return `#/calendar?${params}`;
}

function dayLink(dateKey, accountId) {
  const params = new URLSearchParams();
  params.set("from", dateKey);
  params.set("to", dateKey);
  if (accountId) params.set("account_id", String(accountId));
  return `#/trades?${params}`;
}

function pnlClass(n) {
  if (n == null) return "dim";
  if (n > 0) return "profit";
  if (n < 0) return "loss";
  return "";
}
