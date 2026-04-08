import { listAccounts, computeHeadroom } from "../lib/accounts.js";
import { fmtMoney, esc } from "../lib/format.js";

export async function render() {
  const accounts = await listAccounts({ includeArchived: false });

  const totalSize = accounts.reduce((s, a) => s + a.account_size, 0);
  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);
  const totalPnL = totalBalance - totalSize;
  const pnlClass = totalPnL > 0 ? "profit" : totalPnL < 0 ? "loss" : "";

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Overview</div>
        <h1>Dashboard</h1>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Active accounts</div>
        <div class="stat-value">${accounts.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total starting capital</div>
        <div class="stat-value">${fmtMoney(totalSize)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total balance</div>
        <div class="stat-value">${fmtMoney(totalBalance)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total P&amp;L</div>
        <div class="stat-value ${pnlClass}">${fmtMoney(totalPnL, {
    signed: true,
  })}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Accounts</h2>
        <a href="#/accounts" class="btn-link">Manage →</a>
      </div>
      ${
        accounts.length === 0
          ? `<div class="card empty-state">
              <h3>No accounts yet</h3>
              <p>Head to <a href="#/accounts">Accounts</a> to add your first funded prop or cash brokerage account.</p>
            </div>`
          : `<div class="card" style="padding:0">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th style="text-align:right">Balance</th>
                    <th style="text-align:right">P&amp;L</th>
                    <th style="text-align:right">Headroom</th>
                  </tr>
                </thead>
                <tbody>
                  ${accounts.map(accountRow).join("")}
                </tbody>
              </table>
            </div>`
      }
    </div>
  `;

  function mount(pageEl) {
    pageEl.querySelectorAll("tr.clickable").forEach((tr) => {
      tr.addEventListener("click", () => {
        location.hash = `#/accounts/${tr.dataset.id}`;
      });
    });
  }

  return { html, mount };
}

function accountRow(a) {
  const pnl = a.current_balance - a.account_size;
  const pnlClass = pnl > 0 ? "profit" : pnl < 0 ? "loss" : "muted";
  const hr = computeHeadroom(a);
  let headroomCell = `<span class="dim">—</span>`;
  if (a.type === "funded" && hr.trailingRoom != null) {
    const cls =
      hr.trailingRoom < 500 ? "loss" : hr.trailingRoom < 1500 ? "" : "profit";
    headroomCell = `<span class="${cls}">${fmtMoney(hr.trailingRoom)}</span>`;
  }
  return `
    <tr class="clickable" data-id="${a.id}">
      <td><strong>${esc(a.name)}</strong>
        <div class="muted" style="font-size:var(--fs-xs)">${esc(
          a.type === "funded" ? a.prop_firm || "" : a.broker || ""
        )}</div>
      </td>
      <td><span class="badge ${a.type}">${a.type}</span></td>
      <td style="text-align:right">${fmtMoney(a.current_balance)}</td>
      <td style="text-align:right" class="${pnlClass}">${fmtMoney(pnl, {
    signed: true,
  })}</td>
      <td style="text-align:right">${headroomCell}</td>
    </tr>
  `;
}
