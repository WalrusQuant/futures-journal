const STEPS = [
  {
    n: "01",
    title: "Write the plan",
    body: "Pick an instrument, direction, entry, stop, target, and size. The form computes your planned R:R live as you fill it in. The database requires both a stop AND a target — a plan without a target isn't a plan, it's a hope.",
  },
  {
    n: "02",
    title: "Take the trade",
    body: "When the setup triggers, click \"Take trade\" from the plan. The form pre-fills and runs a pre-trade risk check against open risk, daily loss budget, drawdown headroom, and contract caps. Red blockers can be overridden, but the override and the reason you gave get recorded on the trade so you can see your discipline pattern over time.",
  },
  {
    n: "03",
    title: "Review it",
    body: "When the trade closes, it lands in the \"needs review\" bucket and a banner appears on the dashboard. Fill in plan-followed, exit discipline, emotional state, and a one-sentence lesson. The analytics page surfaces review coverage so you can see whether you're actually doing the work.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-b border-[var(--color-border)] bg-[var(--color-surface)]/30">
      <div className="container-page py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Plan. Trade. Review.
          </h2>
          <p className="mt-4 text-[var(--color-muted)] text-lg">
            Three steps, enforced by the app. The plan → trade → review loop
            is the single biggest behavioral change this journal encourages.
          </p>
        </div>

        <ol className="mx-auto max-w-3xl space-y-10">
          {STEPS.map((step) => (
            <li key={step.n} className="grid grid-cols-[auto_1fr] gap-5 sm:gap-8">
              <div className="font-mono text-3xl sm:text-4xl text-[var(--color-accent)] tabular-nums leading-none pt-1">
                {step.n}
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-[var(--color-text)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-[var(--color-muted)] leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
