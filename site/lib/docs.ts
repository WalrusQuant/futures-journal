import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// Docs live one level up from the Next app, at <repo>/docs/**/*.md
const DOCS_ROOT = path.join(process.cwd(), "..", "docs");

export type DocMeta = {
  slug: string[]; // e.g. ["concepts", "the-two-ledgers"]
  slugString: string; // e.g. "concepts/the-two-ledgers"
  title: string;
  category: DocCategoryKey;
  description?: string;
  filePath: string;
};

export type DocCategoryKey =
  | "getting-started"
  | "concepts"
  | "guides"
  | "faq"
  | "root";

export const CATEGORY_LABELS: Record<DocCategoryKey, string> = {
  "getting-started": "Getting started",
  concepts: "Concepts",
  guides: "Guides",
  faq: "FAQ",
  root: "Overview",
};

export const CATEGORY_ORDER: DocCategoryKey[] = [
  "root",
  "getting-started",
  "concepts",
  "guides",
  "faq",
];

// Manual ordering inside each category so the sidebar reads in the right sequence.
const ORDER_WITHIN: Record<DocCategoryKey, string[]> = {
  root: ["README"],
  "getting-started": ["install", "quickstart", "philosophy"],
  concepts: [
    "accounts-and-categories",
    "the-two-ledgers",
    "plans-and-trades",
    "r-multiples",
    "drawdown-modes",
    "the-risk-engine",
    "fees-and-fee-attribution",
  ],
  guides: [
    "setting-up-your-first-account",
    "configuring-prop-firm-rules",
    "writing-a-plan",
    "taking-a-plan",
    "logging-a-normal-trade",
    "logging-a-scale-in-trade",
    "logging-a-scale-out-trade",
    "moving-your-stop",
    "overriding-a-risk-block",
    "reviewing-a-closed-trade",
    "recording-a-payout",
    "recording-subscription-fees",
    "transferring-between-accounts",
    "archiving-a-failed-combine",
    "using-tags",
    "attaching-screenshots",
  ],
  faq: ["faq"],
};

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p, base));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTitle(raw: string, fallback: string): string {
  const m = raw.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function extractDescription(raw: string): string | undefined {
  // First non-empty, non-heading paragraph after stripping frontmatter
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith(">")) continue;
    if (line.startsWith("---")) continue;
    // Skip list items — bad summaries
    if (line.startsWith("-") || line.startsWith("*")) continue;
    return line.length > 200 ? line.slice(0, 197) + "..." : line;
  }
  return undefined;
}

let cache: DocMeta[] | null = null;

export function getAllDocs(): DocMeta[] {
  if (cache) return cache;
  if (!fs.existsSync(DOCS_ROOT)) return [];

  const files = walk(DOCS_ROOT);
  const metas: DocMeta[] = files.map((filePath) => {
    const rel = path.relative(DOCS_ROOT, filePath); // e.g. "concepts/the-two-ledgers.md"
    const parts = rel.replace(/\.md$/, "").split(path.sep);

    let category: DocCategoryKey = "root";
    if (parts.length > 1) {
      const first = parts[0];
      if (first === "getting-started") category = "getting-started";
      else if (first === "concepts") category = "concepts";
      else if (first === "guides") category = "guides";
    } else if (parts[0] === "faq") {
      category = "faq";
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const { content, data } = matter(raw);
    const fallbackTitle = humanizeSlug(parts[parts.length - 1]);
    const title = (data.title as string) ?? extractTitle(content, fallbackTitle);
    const description =
      (data.description as string) ?? extractDescription(content);

    return {
      slug: parts,
      slugString: parts.join("/"),
      title,
      category,
      description,
      filePath,
    };
  });

  // Sort by category then by manual order
  metas.sort((a, b) => {
    const catDelta =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catDelta !== 0) return catDelta;
    const order = ORDER_WITHIN[a.category];
    const last = a.slug[a.slug.length - 1];
    const otherLast = b.slug[b.slug.length - 1];
    const ai = order.indexOf(last);
    const bi = order.indexOf(otherLast);
    if (ai === -1 && bi === -1) return a.title.localeCompare(b.title);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  cache = metas;
  return metas;
}

export function getDocBySlug(slug: string[]): DocMeta | undefined {
  return getAllDocs().find(
    (d) => d.slugString === slug.join("/"),
  );
}

export function getDocsByCategory(): Array<{
  key: DocCategoryKey;
  label: string;
  docs: DocMeta[];
}> {
  const all = getAllDocs();
  return CATEGORY_ORDER
    .map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      docs: all.filter((d) => d.category === key && d.slugString !== "README"),
    }))
    .filter((g) => g.docs.length > 0);
}

export function readDocSource(meta: DocMeta): string {
  return fs.readFileSync(meta.filePath, "utf-8");
}
