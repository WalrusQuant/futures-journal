import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import matter from "gray-matter";
import {
  getAllDocs,
  getDocBySlug,
  readDocSource,
} from "@/lib/docs";
import { rewriteDocLinks } from "@/lib/mdx";

type Params = { slug: string[] };

export function generateStaticParams(): Params[] {
  return getAllDocs()
    .filter((d) => d.slugString !== "README")
    .map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  const rawSource = readDocSource(doc);
  const { content } = matter(rawSource);
  const rewritten = rewriteDocLinks(content, doc.slug);

  // Determine prev / next based on sidebar order
  const all = getAllDocs().filter(
    (d) => d.slugString !== "README" && d.category !== "root",
  );
  const idx = all.findIndex((d) => d.slugString === doc.slugString);
  const prev = idx > 0 ? all[idx - 1] : undefined;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : undefined;

  return (
    <article>
      <nav className="text-xs font-mono uppercase tracking-wider text-[var(--color-dim)] mb-4">
        <Link href="/docs" className="hover:text-[var(--color-accent)]">
          Docs
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--color-muted)]">{doc.category}</span>
      </nav>

      <div className="prose-fj">
        <MDXRemote
          source={rewritten}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [
                rehypeSlug,
                [
                  rehypeAutolinkHeadings,
                  { behavior: "wrap" },
                ],
                [
                  rehypePrettyCode,
                  {
                    theme: "github-dark-dimmed",
                    keepBackground: false,
                  },
                ],
              ],
            },
          }}
        />
      </div>

      {(prev || next) && (
        <div className="mt-16 grid gap-4 sm:grid-cols-2 pt-8 border-t border-[var(--color-border)]">
          {prev ? (
            <Link
              href={`/docs/${prev.slugString}`}
              className="group rounded-md border border-[var(--color-border)] p-4 hover:border-[var(--color-accent-dim)] transition-colors"
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-dim)]">
                ← Previous
              </div>
              <div className="mt-1 font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                {prev.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slugString}`}
              className="group rounded-md border border-[var(--color-border)] p-4 sm:text-right hover:border-[var(--color-accent-dim)] transition-colors"
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-dim)]">
                Next →
              </div>
              <div className="mt-1 font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                {next.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}
    </article>
  );
}
