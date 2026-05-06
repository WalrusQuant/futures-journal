import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_ROOT = path.join(process.cwd(), "content", "blog");

export type BlogPost = {
  slug: string;
  title: string;
  description?: string;
  date: string; // ISO
  filePath: string;
};

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_ROOT)) return [];
  const files = fs
    .readdirSync(BLOG_ROOT)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));

  const posts: BlogPost[] = files.map((file) => {
    const filePath = path.join(BLOG_ROOT, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    const slug = file.replace(/\.mdx?$/, "");
    return {
      slug,
      title: (data.title as string) ?? slug,
      description: data.description as string | undefined,
      date: (data.date as string) ?? "1970-01-01",
      filePath,
    };
  });

  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

export function readPostSource(post: BlogPost): string {
  return fs.readFileSync(post.filePath, "utf-8");
}
