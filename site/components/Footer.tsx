import Link from "next/link";
import { SITE } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-24">
      <div className="container-page py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-sm">
        <div className="text-[var(--color-muted)] font-mono">
          © {new Date().getFullYear()}{" "}
          <a
            href={SITE.authorUrl}
            className="hover:text-[var(--color-accent)] transition-colors"
          >
            {SITE.author}
          </a>
        </div>
        <nav className="flex items-center gap-5 text-[var(--color-muted)]">
          <Link href="/docs" className="hover:text-[var(--color-text)]">Docs</Link>
          <Link href="/blog" className="hover:text-[var(--color-text)]">Blog</Link>
          <Link href="/buy" className="hover:text-[var(--color-accent)]">Buy</Link>
          <a
            href={SITE.authorUrl}
            className="hover:text-[var(--color-text)]"
            target="_blank"
            rel="noopener"
          >
            adamwickwire.com ↗
          </a>
        </nav>
      </div>
    </footer>
  );
}
