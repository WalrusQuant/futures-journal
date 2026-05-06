import Link from "next/link";
import { CheckoutButton } from "./CheckoutButton";
import { REPO_URL } from "@/lib/config";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)]">
      <div className="absolute inset-0 hero-grid pointer-events-none" />
      <div className="container-page relative py-24 sm:py-32">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent-dim)] bg-[var(--color-surface)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
            Free · Open source
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
            A journal that treats{" "}
            <span className="text-[var(--color-accent)]">
              futures like futures
            </span>
            .
          </h1>
          <p className="mt-6 text-lg text-[var(--color-muted)] leading-relaxed max-w-2xl">
            A desktop trading journal for futures. Plans, trades, reviews,
            two-ledger P&amp;L, and a pre-trade risk check that flags rule
            violations before you save. Mac and Windows. No cloud, no
            account, no telemetry.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <CheckoutButton size="lg">Download for free →</CheckoutButton>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Read the docs
              <span aria-hidden>→</span>
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              View on GitHub
              <span aria-hidden>↗</span>
            </a>
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-[var(--color-dim)]">
            MIT-licensed · No account · No telemetry · Local-only
          </p>
        </div>
      </div>
    </section>
  );
}
