import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import matter from "gray-matter";
import { getAllPosts, getPostBySlug, readPostSource } from "@/lib/blog";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return { title: post.title, description: post.description };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const raw = readPostSource(post);
  const { content } = matter(raw);

  return (
    <article className="container-narrow py-16">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-dim)] hover:text-[var(--color-accent)]"
      >
        ← All posts
      </Link>
      <header className="mt-6 mb-10">
        <time className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)]">
          {new Date(post.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {post.title}
        </h1>
        {post.description && (
          <p className="mt-4 text-lg text-[var(--color-muted)]">
            {post.description}
          </p>
        )}
      </header>
      <div className="prose-fj">
        <MDXRemote
          source={content}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [
                rehypeSlug,
                [rehypeAutolinkHeadings, { behavior: "wrap" }],
                [
                  rehypePrettyCode,
                  { theme: "github-dark-dimmed", keepBackground: false },
                ],
              ],
            },
          }}
        />
      </div>
    </article>
  );
}
