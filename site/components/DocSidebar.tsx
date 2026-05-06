"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocCategoryKey } from "@/lib/docs";

type SidebarData = Array<{
  key: DocCategoryKey;
  label: string;
  docs: Array<{ slugString: string; title: string }>;
}>;

type Props = {
  groups: SidebarData;
};

export function DocSidebar({ groups }: Props) {
  const pathname = usePathname() ?? "";
  const activeSlug = pathname.startsWith("/docs/")
    ? pathname.replace(/^\/docs\//, "")
    : undefined;

  return (
    <nav className="text-sm">
      <Link
        href="/docs"
        className={`block px-3 py-1.5 rounded font-mono text-[11px] uppercase tracking-wider ${
          !activeSlug
            ? "bg-[var(--color-surface)] text-[var(--color-accent)]"
            : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
        }`}
      >
        Overview
      </Link>
      {groups
        .filter((g) => g.key !== "root")
        .map((group) => (
          <div key={group.key} className="mt-6">
            <div className="px-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-dim)] mb-1.5">
              {group.label}
            </div>
            <ul>
              {group.docs.map((d) => {
                const isActive = activeSlug === d.slugString;
                return (
                  <li key={d.slugString}>
                    <Link
                      href={`/docs/${d.slugString}`}
                      className={`block px-3 py-1.5 rounded border-l-2 transition-colors ${
                        isActive
                          ? "border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-text)]"
                          : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      {d.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </nav>
  );
}
