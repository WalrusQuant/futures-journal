// Real money ledger page.
//
// Shows the user's actual net-worth trajectory from trading activity:
// external deposits/withdrawals, prop-firm payouts received, subscription
// and reset fees paid, and cash-account trade P&L. Funded-account
// trading P&L is deliberately excluded — it's simulated until withdrawn.
//
// Includes archived accounts by default (you need historical fees from
// failed combines in your real-money picture) with no toggle, matching
// the "ledger shows everything real" principle.
import { listAllTransactions, listAccounts, categoryDef } from "../lib/accounts.js";
import { listTrades } from "../lib/trades.js";
import {
  realMoneyLedger,
  filterLedgerByRange,
  feesByPaidForAccount,
} from "../lib/ledger.js";
import { lineChart } from "../components/charts.js";
import { fmtMoney, fmtDate, esc } from "../lib/format.js";

export async function render() {
  // Archived accounts included — historical fees from failed combines
  // are still real money you spent, and we want them in the ledger.
  const [accounts, txs, trades] = await Promise.all([
    listAccounts({ includeArchived: true }),
    listAllTransactions(),
    listTrades({}),
  ]);

  const ledger = realMoneyLedger(accounts, trades, txs);

  // Date window from URL. Defaults to "all time."
  const range = readRange();
  const view = range.from && range.to
    ? filterLedgerByRange(ledger, range.from, range.to)
    : ledger;

  const perAccountFees = feesByPaidForAccount(view);

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Real money</div>
        <h1>Ledger</h1>
        <div class="muted" style="margin-top:4px">
          Your actual cash flow from trading — external deposits, prop firm payouts,
          subscription and reset fees, and cash-account P&amp;L. Simulated trades are excluded.
        </div>
      </div>
    </div>

    ${renderRangePills(range)}

    ${renderTotalsGrid(view.totals, view.running)}

    ${
      view.events.length > 0
        ? `<div class="section">
            <div class="section-header"><h2>Real-money curve</h2></div>
            <div class="card">
              ${lineChart(view.curve.map((p, i) => ({ x: i, y: p.balance, label: p.t })), {
                width: 720,
                height: 220,
                yZeroLine: true,
              })}
              <div class="muted" style="font-size:var(--fs-xs);margin-top:var(--sp-2)">
                ${view.events.length} event${view.events.length === 1 ? "" : "s"} — starts at $0
              </div>
            </div>
          </div>`
        : `<div class="card empty-state"><p>No real-money events in this range.</p></div>`
    }

    ${renderPerAccountFees(perAccountFees)}

    ${renderEventTable(view.events)}
  `;

  function mount(pageEl) {
    pageEl.querySelectorAll("[data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.range;
        setRange(key);
      });
    });
  }

  return { html, mount };
}

// ---------- Range handling ----------

function readRange() {
  const hash = location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx < 0) return { key: "all", from: null, to: null };
  const sp = new URLSearchParams(hash.slice(qIdx + 1));
  const key = sp.get("range") || "all";
  return rangeForKey(key);
}

function rangeForKey(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.toISOString();
  const startOfMonth = new Date(y, m, 1, 0, 0, 0, 0);
  const startOfQuarter = new Date(y, Math.floor(m / 3) * 3, 1, 0, 0, 0, 0);
  const startOfYear = new Date(y, 0, 1, 0, 0, 0, 0);
  const endOfDay = new Date(y, m, now.getDate(), 23, 59, 59, 999);

  switch (key) {
    case "mtd":
      return { key, from: iso(startOfMonth), to: iso(endOfDay) };
    case "qtd":
      return { key, from: iso(startOfQuarter), to: iso(endOfDay) };
    case "ytd":
      return { key, from: iso(startOfYear), to: iso(endOfDay) };
    case "all":
    default:
      return { key: "all", from: null, to: null };
  }
}

function setRange(key) {
  const base = location.hash.split("?")[0] || "#/ledger";
  location.hash = `${base}?range=${key}`;
}

function renderRangePills(range) {
  const keys = [
    { key: "mtd", label: "Month" },
    { key: "qtd", label: "Quarter" },
    { key: "ytd", label: "Year" },
    { key: "all", label: "All time" },
  ];
  return `
    <div class="filter-bar" style="gap:var(--sp-2)">
      ${keys
        .map(
          (k) => `
            <button class="pill${
              range.key === k.key ? " pill-active" : ""
            }" data-range="${k.key}">${k.label}</button>
          `
        )
        .join("")}
    </div>
  `;
}

// ---------- Totals grid ----------

function renderTotalsGrid(totals, running) {
  const netClass = running > 0 ? "profit" : running < 0 ? "loss" : "";
  const tiles = [
    {
      label: "Net real money",
      value: fmtMoney(running, { signed: true }),
      tone: netClass,
      sub: "inflows − outflows + cash trading",
    },
    {
      label: "Deposits",
      value: fmtMoney(totals.external_in),
      tone: totals.external_in > 0 ? "profit" : "",
      sub: "external money in",
    },
    {
      label: "Withdrawals",
      value: fmtMoney(totals.external_out),
      tone: totals.external_out < 0 ? "loss" : "",
      sub: "external money out",
    },
    {
      label: "Payouts received",
      value: fmtMoney(totals.payout_received),
      tone: totals.payout_received > 0 ? "profit" : "",
      sub: "from funded accounts",
    },
    {
      label: "Subscription fees",
      value: fmtMoney(totals.sub_fee),
      tone: totals.sub_fee < 0 ? "loss" : "",
      sub: "monthly combine / eval",
    },
    {
      label: "Reset + activation",
      value: fmtMoney(totals.reset_fee + totals.activation_fee),
      tone:
        totals.reset_fee + totals.activation_fee < 0 ? "loss" : "",
      sub: "one-time firm costs",
    },
    {
      label: "Cash trading P&L",
      value: fmtMoney(totals.cash_trade, { signed: true }),
      tone: totals.cash_trade > 0 ? "profit" : totals.cash_trade < 0 ? "loss" : "",
      sub: "real broker accounts only",
    },
  ];
  return `
    <div class="stats-grid">
      ${tiles
        .map(
          (t) => `
            <div class="stat">
              <div class="stat-label">${esc(t.label)}</div>
              <div class="stat-value ${t.tone}">${t.value}</div>
              <div class="stat-sub">${esc(t.sub)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

// ---------- Per-account fee breakdown ----------

function renderPerAccountFees(map) {
  const rows = [];
  for (const [key, bucket] of map) {
    rows.push({ key, ...bucket });
  }
  if (rows.length === 0) return "";
  rows.sort((a, b) => a.totals.total - b.totals.total); // most negative first
  return `
    <div class="section">
      <div class="section-header"><h2>Fee burn by account</h2></div>
      <div class="card" style="padding:0">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th style="text-align:right">Subs</th>
              <th style="text-align:right">Resets</th>
              <th style="text-align:right">Activation</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
                  <tr>
                    <td>${
                      r.account
                        ? `<strong>${esc(r.account.name)}</strong> <span class="dim">${esc(
                            categoryDef(r.account.category)?.label || r.account.type
                          )}</span>`
                        : `<span class="muted">(unattributed)</span>`
                    }</td>
                    <td class="num loss">${fmtMoney(r.totals.sub_fee)}</td>
                    <td class="num loss">${fmtMoney(r.totals.reset_fee)}</td>
                    <td class="num loss">${fmtMoney(r.totals.activation_fee)}</td>
                    <td class="num loss"><strong>${fmtMoney(r.totals.total)}</strong></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ---------- Event table ----------

function renderEventTable(events) {
  if (events.length === 0) return "";
  // Most recent first for the table, chronological for the curve.
  const rows = events.slice().reverse();
  return `
    <div class="section">
      <div class="section-header"><h2>Events</h2></div>
      <div class="card" style="padding:0">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Kind</th>
              <th>Category</th>
              <th style="text-align:right">Amount</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(renderEventRow).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderEventRow(e) {
  const tone = e.delta > 0 ? "profit" : e.delta < 0 ? "loss" : "";
  const detail = e.counterparty
    ? `↔ ${esc(e.counterparty.name)}`
    : e.paidFor
    ? `for ${esc(e.paidFor.name)}`
    : e.trade
    ? `trade #${e.trade.id}`
    : e.tx?.note
    ? esc(e.tx.note)
    : "";
  return `
    <tr>
      <td>${fmtDate(e.t)}</td>
      <td>${esc(e.account.name)} <span class="dim">${esc(
    categoryDef(e.account.category)?.label || e.account.type
  )}</span></td>
      <td>${esc(kindLabel(e.kind))}</td>
      <td><span class="badge ${e.category}">${esc(categoryLabelFromCode(e.category))}</span></td>
      <td class="num ${tone}">${fmtMoney(e.delta, { signed: true })}</td>
      <td class="muted">${detail}</td>
    </tr>
  `;
}

function kindLabel(k) {
  const m = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    payout: "Payout",
    fee: "Fee",
    reset: "Reset",
    activation: "Activation",
    transfer_in: "Transfer in",
    transfer_out: "Transfer out",
    trade: "Cash trade",
  };
  return m[k] || k;
}

function categoryLabelFromCode(c) {
  const m = {
    external_in: "External in",
    external_out: "External out",
    payout_received: "Payout received",
    sub_fee: "Sub fee",
    reset_fee: "Reset fee",
    activation_fee: "Activation",
    cash_trade: "Cash trade",
    internal_transfer: "Internal transfer",
  };
  return m[c] || c;
}
