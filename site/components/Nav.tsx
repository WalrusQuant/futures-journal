import Link from "next/link";
import { CheckoutButton } from "./CheckoutButton";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[color:var(--color-bg)]/80 border-b border-[var(--color-border)]">
      <div className="container-page flex items-center justify-between h-14">
        <Link
          href="/"
          className="font-mono text-sm tracking-[0.18em] uppercase text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
        >
          Futures Journal
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          <Link
            href="/docs"
            className="px-3 py-1.5 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/blog"
            className="px-3 py-1.5 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Blog
          </Link>
          <CheckoutButton size="sm">Download</CheckoutButton>
        </nav>
      </div>
    </header>
  );
}
