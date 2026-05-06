import Link from "next/link";
import { LaunchBadge } from "./LaunchBadge";
import { CheckoutButton } from "./CheckoutButton";
import { PRICING } from "@/lib/config";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)]">
      <div className="absolute inset-0 hero-grid pointer-events-none" />
      <div className="container-page relative py-24 sm:py-32">
        <div className="max-w-3xl">
          <LaunchBadge />
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
            <CheckoutButton size="lg">
              Buy for ${PRICING.launch}
              <span className="ml-2 font-mono text-xs text-[#04181a]/60 line-through">
                ${PRICING.regular}
              </span>
            </CheckoutButton>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Read the docs
              <span aria-hidden>→</span>
            </Link>
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-[var(--color-dim)]">
            Lifetime updates · No refunds (digital product) · One-time payment
          </p>
        </div>
      </div>
    </section>
  );
}
