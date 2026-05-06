import { CheckoutButton } from "./CheckoutButton";
import { REPO_URL } from "@/lib/config";

const INCLUDES = [
  "Mac and Windows desktop builds",
  "Every future update, forever",
  "Full knowledge base",
  "Your data on your disk, never in the cloud",
  "MIT-licensed source code on GitHub",
];

export function Pricing() {
  return (
    <section
      id="download"
      className="border-t border-b border-[var(--color-border)]"
    >
      <div className="container-page py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Free. Open source. Local.
          </h2>
          <p className="mt-4 text-[var(--color-muted)] text-lg">
            I built this for myself and decided to give it away. No paywall,
            no upsell, no telemetry.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <div className="relative rounded-xl border border-[var(--color-accent-dim)] bg-[var(--color-surface)] p-8 shadow-[0_0_0_1px_rgba(94,224,229,0.08),0_30px_80px_-30px_rgba(94,224,229,0.25)]">
            <div className="text-center">
              <div className="font-mono text-xs uppercase tracking-wider text-[var(--color-dim)]">
                Futures Journal
              </div>
              <div className="mt-5 flex items-baseline justify-center gap-3">
                <span className="text-6xl font-semibold text-[var(--color-text)] tabular-nums">
                  Free
                </span>
              </div>
              <div className="mt-2 text-xs text-[var(--color-muted)]">
                MIT license · No account · No tracking
              </div>
            </div>

            <ul className="mt-8 space-y-3 text-sm">
              {INCLUDES.map((it) => (
                <li
                  key={it}
                  className="flex items-start gap-3 text-[var(--color-text)]"
                >
                  <span className="mt-1 text-[var(--color-accent)]">✓</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col items-center">
              <CheckoutButton size="lg">
                <span>Download for free</span>
                <span aria-hidden>→</span>
              </CheckoutButton>
              <p className="mt-4 text-[11px] font-mono uppercase tracking-wider text-[var(--color-dim)] text-center">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener"
                  className="hover:text-[var(--color-accent)]"
                >
                  Source on GitHub ↗
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
