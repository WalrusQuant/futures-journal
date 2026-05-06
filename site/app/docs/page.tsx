import Link from "next/link";
import type { Metadata } from "next";
import { getDocsByCategory } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Concepts, guides, and FAQ for Futures Journal — the opinionated local-first journal for prop firm futures traders.",
};

export default function DocsIndexPage() {
  const groups = getDocsByCategory().filter((g) => g.key !== "root");

  return (
    <article className="max-w-3xl">
      <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)] mb-2">
        Knowledge base
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
      <p className="mt-4 text-lg text-[var(--color-muted)] leading-relaxed">
        How the app thinks, how to use it, and how to handle the real
        situations you'll run into as a futures trader working through prop
        firm combines and payouts.
      </p>

      <div className="mt-10 space-y-12">
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-1">
              {group.label}
            </h2>
            <ul className="mt-4 space-y-3">
              {group.docs.map((d) => (
                <li key={d.slugString}>
                  <Link
                    href={`/docs/${d.slugString}`}
                    className="group block rounded-md border border-[var(--color-border)] p-4 hover:border-[var(--color-accent-dim)] hover:bg-[var(--color-surface)] transition-colors"
                  >
                    <div className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                      {d.title}
                    </div>
                    {d.description && (
                      <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">
                        {d.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
