const PRINCIPLES = [
  {
    title: "Futures only",
    body: "No stocks, no options, no crypto, no forex. The math, validators, analytics, and risk engine all assume point_value × contracts P&L. Percentage moves and share counts don't appear anywhere because they don't mean anything in this context.",
  },
  {
    title: "Stops required on every trade",
    body: "The trade form won't save a trade without a stop. An entry with no stop isn't a trade — it's a mistake you got away with, or didn't. If you use a mental stop, enter your worst-case exit price as the risk. What the form refuses is silence.",
  },
  {
    title: "R-multiples, not percentages",
    body: "R — profit or loss divided by initial risk — is how the analytics page ranks trades and reports expectancy. Dollar P&L is always shown. Percent of account size is a stock-trader metric; dragging it into futures produces numbers that look meaningful and aren't.",
  },
  {
    title: "Plans need entry, stop, and target",
    body: "The plan form requires all three. If you can't pick a target price, you don't have a plan — you have a directional bias and a hope. The plans.target_price column is NOT NULL at the schema level, so it's enforced below the UI as well.",
  },
  {
    title: "Firm rules live on the account",
    body: "Apex, Topstep, Tradeify, MFFU — they change their rules every few months. Rather than hardcoding per-firm branches, the app models drawdown mode, lock offset, daily loss limit, contract caps, and consistency percentage as generic per-account fields. When a firm changes a number, you update one field.",
  },
  {
    title: "Two ledgers, parallel",
    body: "The sim ledger tracks combine, sim-funded, and live-funded P&L — fake money for rule-tracking. The real ledger tracks your actual net worth — cash, bank, payouts received, fees paid. Conflating them is how new prop traders feel rich when they're actually down for the year.",
  },
  {
    title: "Failed combines archive, not delete",
    body: "When a combine fails, archive it. The trade history stays, the review notes stay, the risk overrides stay, and you can include archived accounts on the analytics page whenever you want to see what went wrong across all your attempts.",
  },
  {
    title: "Local-first, no telemetry",
    body: "Your entire database is a single SQLite file on your own disk. There's no cloud, no account to create, no sync, no usage statistics, no crash reporter. You can unplug the machine and the app works perfectly. Daily automatic backups with 14-day rolling retention.",
  },
];

export function PhilosophyGrid() {
  return (
    <section className="border-t border-b border-[var(--color-border)] bg-[var(--color-surface)]/30">
      <div className="container-page py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            What the app is opinionated about
          </h2>
          <p className="mt-4 text-[var(--color-muted)] text-lg">
            Every journal is opinionated whether it admits it or not — the
            defaults, the fields, the metrics shown on the dashboard. This
            one is opinionated on purpose, out loud, and the constraints
            are the point.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p) => (
            <div
              key={p.title}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-5 transition-colors hover:border-[var(--color-accent-dim)]"
            >
              <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)]">
                {p.title}
              </div>
              <p className="mt-3 text-sm text-[var(--color-muted)] leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
