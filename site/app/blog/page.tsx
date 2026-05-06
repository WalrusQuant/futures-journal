import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Trading notes, lessons learned, and updates on Futures Journal.",
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="container-narrow py-16">
      <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)] mb-2">
        Blog
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">Notes</h1>
      <p className="mt-4 text-lg text-[var(--color-muted)]">
        Trading notes, lessons from running combines, and the occasional
        update on the app.
      </p>

      {posts.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center">
          <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-dim)]">
            Coming soon
          </div>
          <p className="mt-3 text-[var(--color-muted)]">
            First post is on the way. Check back soon.
          </p>
        </div>
      ) : (
        <ul className="mt-12 divide-y divide-[var(--color-border)] border-t border-b border-[var(--color-border)]">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block py-6 hover:bg-[var(--color-surface)]/50 -mx-2 px-2 rounded"
              >
                <time className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-dim)]">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <div className="mt-1 text-xl font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                  {post.title}
                </div>
                {post.description && (
                  <p className="mt-2 text-[var(--color-muted)]">
                    {post.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
