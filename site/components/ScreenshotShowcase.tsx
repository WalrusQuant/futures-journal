import Image from "next/image";
import { BASE_PATH } from "@/lib/config";

const SHOTS = [
  {
    src: `${BASE_PATH}/screenshots/dashboard.png`,
    alt: "Dashboard showing today's P&L, active account cards, equity curve, recent trades, and active plans",
    title: "Dashboard",
    caption:
      "Today's P&L, every active account with its drawdown and headroom, the equity curve, recent trades, and active plans — all on one screen.",
    width: 2400,
    height: 1500,
  },
  {
    src: `${BASE_PATH}/screenshots/Analytics.png`,
    alt: "Analytics view with trade count, net P&L, win rate, profit factor, expectancy, average hold time, streaks, and review coverage",
    title: "Analytics",
    caption:
      "R-multiples, win rate, expectancy, profit factor, average hold time, best/worst trades, longest win and loss streaks, and review coverage. Filter by account, instrument, planned/unplanned, and category.",
    width: 2400,
    height: 1500,
  },
  {
    src: `${BASE_PATH}/screenshots/accounts.png`,
    alt: "Account detail view showing a Combine / Evaluation account with drawdown type, drawdown amount, lock rule, daily loss limit, profit target, and contract caps",
    title: "Accounts",
    caption:
      "One account per combine, sim-funded, live-funded, cash brokerage, or personal bank. Drawdown mode, lock rule, daily loss limit, profit target, and contract caps are fields on the account — not hardcoded firm logic.",
    width: 2400,
    height: 1500,
  },
];

export function ScreenshotShowcase() {
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="space-y-20">
        {SHOTS.map((shot) => (
          <figure key={shot.src}>
            <div className="relative rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6),0_0_0_1px_rgba(94,224,229,0.06)] overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                <span className="ml-3 font-mono text-[10px] text-[var(--color-dim)] lowercase">
                  futures journal — {shot.title.toLowerCase()}
                </span>
              </div>
              <Image
                src={shot.src}
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
                sizes="(max-width: 1024px) 100vw, 1100px"
                className="w-full h-auto"
              />
            </div>
            <figcaption className="mt-5 max-w-3xl text-[var(--color-muted)] text-base sm:text-lg leading-relaxed">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)] mr-2">
                {shot.title}
              </span>
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
