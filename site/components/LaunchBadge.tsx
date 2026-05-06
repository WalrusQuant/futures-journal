import { PRICING } from "@/lib/config";

export function LaunchBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent-dim)] bg-[color:var(--color-accent)]/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)]">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-60"></span>
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"></span>
      </span>
      Launch · ${PRICING.launch} · First {PRICING.launchSeatsTotal} buyers
    </div>
  );
}
