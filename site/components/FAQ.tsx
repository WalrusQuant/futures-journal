const QUESTIONS = [
  {
    q: "Why does the app insist on a stop on every trade?",
    a: "Because an entry without a stop isn't a trade, it's a mistake waiting to happen. Futures move fast, one tick can be worth a lot of money, and the difference between a losing trade and a career-ending trade is usually whether you defined your out before you pressed the button. The app enforces this with a shape validator — any trade draft that doesn't have a stop gets rejected before it can be saved. No override, no \"just this once\" toggle.",
  },
  {
    q: "Can I use this for stocks, options, or crypto?",
    a: "No. The entire math path — P&L, risk, R-multiple, contract caps, drawdown enforcement — assumes point_value × contracts dollar P&L, which is the futures model. Stocks and crypto need different math (shares, fractional positions, percentage P&L), and the app deliberately doesn't support them because trying to be a generalized journal would dilute everything that makes it useful for futures traders.",
  },
  {
    q: "Where is my data stored?",
    a: "Locally, in the standard Tauri app-data directory for your OS. On macOS that's ~/Library/Application Support/com.adamwickwire.futuresjournal/. You'll find your SQLite database, attached chart screenshots, and automatic daily JSON backups (14-day rolling retention) there. Nothing ever leaves the machine — no cloud, no telemetry, no ping-home.",
  },
  {
    q: "What's the difference between Combine, Sim funded, and Live funded?",
    a: "All three are simulated accounts for rule-tracking, but they correspond to different stages of the prop firm pipeline. Combine: you're paying a subscription to qualify against the firm's rules. Sim funded: you passed the combine, trades are still simulated but payouts are real money. Live funded: your fills hit the real market with the firm's capital, though the money isn't yours until you withdraw it.",
  },
  {
    q: "Do I need a bank account in the app if I only trade sim?",
    a: "You don't need one. Everything works without it — you can log trades and track sim P&L with just a combine. But the moment you start paying subscription fees or receiving payouts, you want somewhere to anchor those real-money events, and the Personal bank category is exactly that anchor.",
  },
  {
    q: "What prop firms does this work with?",
    a: "All of them. Apex, Topstep, Tradeify, MFFU, Bulenox, Take Profit Trader — rather than hardcoding per-firm logic that rots every time they change their rules, the app models drawdown mode, lock offset, daily loss limit, contract caps, and consistency percentage as generic per-account fields. You configure them using whatever the firm currently requires. When the firm changes a number, you change a field.",
  },
  {
    q: "Can I override a blocked trade from the risk engine?",
    a: "For stops, no — the app refuses to save a trade without one, period. For other blockers (daily loss limit, drawdown, contract caps), yes — the form prompts you for an override reason, and the override plus your reason gets recorded on the trade row so you can see your discipline pattern over time. The point isn't frictionless dismissal — it's a speed bump that forces you to articulate why you're ignoring the warning.",
  },
  {
    q: "Wait — it's actually free?",
    a: "Yes. MIT-licensed, source on GitHub, signed installers on the Releases page. I built it for myself, decided it was worth sharing, and didn't want a paywall in front of the people who'd actually benefit from it. No upsell tier, no \"pro\" version, no telemetry phoning home.",
  },
  {
    q: "Do I get future updates?",
    a: "Yes. Every release is published to the GitHub Releases page — pull the latest installer whenever you want. No subscriptions, no upgrade fees, no tiered features.",
  },
  {
    q: "Can I contribute or report a bug?",
    a: "Absolutely. The repo is open: file an issue, send a PR, fork it for your own workflow. The codebase is small (vanilla JS frontend, Rust/Tauri shell, SQLite) and the architecture notes in CLAUDE.md and README.md should orient you fast.",
  },
];

export function FAQ() {
  return (
    <section className="container-page py-24">
      <div className="max-w-2xl mb-12">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Questions
        </h2>
      </div>
      <div className="mx-auto max-w-3xl">
        <div className="divide-y divide-[var(--color-border)] border-t border-b border-[var(--color-border)]">
          {QUESTIONS.map((q) => (
            <details key={q.q} className="group py-5">
              <summary className="flex cursor-pointer items-start justify-between gap-6 list-none">
                <span className="text-base sm:text-lg font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                  {q.q}
                </span>
                <span
                  aria-hidden
                  className="mt-1 font-mono text-[var(--color-dim)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 text-[var(--color-muted)] leading-relaxed text-[15px]">
                {q.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
