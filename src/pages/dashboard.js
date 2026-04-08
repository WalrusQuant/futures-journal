import { query } from "../lib/db.js";

export async function render() {
  const instruments = await query("SELECT COUNT(*) as n FROM instruments");
  const accounts = await query("SELECT COUNT(*) as n FROM accounts");
  const trades = await query("SELECT COUNT(*) as n FROM trades");

  return `
    <div class="page-header">
      <div>
        <div class="crumbs">Overview</div>
        <h1>Dashboard</h1>
      </div>
    </div>

    <div class="card">
      <h3>Phase 0 — Skeleton</h3>
      <p class="muted">Database is connected. Schema migration ran successfully.</p>
      <dl class="kv">
        <dt>Instruments seeded</dt><dd>${instruments[0].n}</dd>
        <dt>Accounts</dt><dd>${accounts[0].n}</dd>
        <dt>Trades</dt><dd>${trades[0].n}</dd>
      </dl>
    </div>

    <div class="card">
      <h3>Next: Phase 1 — Accounts</h3>
      <p class="muted">Add funded prop and cash brokerage accounts so you can start logging trades against them.</p>
    </div>
  `;
}
