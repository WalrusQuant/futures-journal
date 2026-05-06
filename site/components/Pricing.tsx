import { CheckoutButton } from "./CheckoutButton";
import { PRICING } from "@/lib/config";

const INCLUDES = [
  "Mac and Windows desktop builds",
  "Every future update, forever",
  "Full knowledge base",
  "Your data on your disk, never in the cloud",
  "One-time payment",
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-b border-[var(--color-border)]">
      <div className="container-page py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            ${PRICING.launch} for the first {PRICING.launchSeatsTotal} buyers
          </h2>
          <p className="mt-4 text-[var(--color-muted)] text-lg">
            Then it&apos;s ${PRICING.regular}. Same app either way.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <div className="relative rounded-xl border border-[var(--color-accent-dim)] bg-[var(--color-surface)] p-8 shadow-[0_0_0_1px_rgba(94,224,229,0.08),0_30px_80px_-30px_rgba(94,224,229,0.25)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full border border-[var(--color-accent-dim)] bg-[var(--color-bg)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
                First {PRICING.launchSeatsTotal} buyers only
              </span>
            </div>

            <div className="text-center">
              <div className="font-mono text-xs uppercase tracking-wider text-[var(--color-dim)]">
                Futures Journal — lifetime license
              </div>
              <div className="mt-5 flex items-baseline justify-center gap-3">
                <span className="font-mono text-2xl text-[var(--color-dim)] line-through">
                  ${PRICING.regular}
                </span>
                <span className="text-6xl font-semibold text-[var(--color-text)] tabular-nums">
                  ${PRICING.launch}
                </span>
              </div>
              <div className="mt-2 text-xs text-[var(--color-muted)]">
                USD · one-time payment
              </div>
            </div>

            <ul className="mt-8 space-y-3 text-sm">
              {INCLUDES.map((it) => (
                <li key={it} className="flex items-start gap-3 text-[var(--color-text)]">
                  <span className="mt-1 text-[var(--color-accent)]">✓</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col items-center">
              <CheckoutButton size="lg">
                <span>Buy for ${PRICING.launch}</span>
                <span aria-hidden>→</span>
              </CheckoutButton>
              <p className="mt-4 text-[11px] font-mono uppercase tracking-wider text-[var(--color-dim)] text-center">
                Secure checkout via Lemon Squeezy · No refunds (digital product)
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
