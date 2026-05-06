import type { MetadataRoute } from "next";
import { getAllDocs } from "@/lib/docs";
import { getAllPosts } from "@/lib/blog";
import { SITE } from "@/lib/config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = ["", "/docs", "/blog"].map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const docRoutes = getAllDocs()
    .filter((d) => d.slugString !== "README")
    .map((d) => ({
      url: `${SITE.url}/docs/${d.slugString}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  const postRoutes = getAllPosts().map((p) => ({
    url: `${SITE.url}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...docRoutes, ...postRoutes];
}
