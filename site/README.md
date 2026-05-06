# futures-journal-site

Marketing + docs site for Futures Journal. Lives at `walrusquant.github.io/futures-journal`.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4, and
`next-mdx-remote` for rendering the existing markdown docs from `../docs/`.

---

## Local development

```bash
cd site
npm install
npm run dev
```

Then open http://localhost:3000.

Routes:

- `/` — landing page
- `/docs` — documentation index (auto-generated from `../docs/**/*.md`)
- `/docs/<category>/<slug>` — individual doc pages
- `/blog` — blog index
- `/blog/<slug>` — individual blog post
- `/buy` — legacy URL, redirects to the GitHub Releases page (kept so old
  links don't 404)

## Editing content

**Docs.** Edit any file under `../docs/`. The site reads them at build time
via `lib/docs.ts` — no copying, no sync step. Internal `.md` links are
auto-rewritten to `/docs/...` routes at render time (see `lib/mdx.ts`).

To re-order or re-label a category in the sidebar, edit `ORDER_WITHIN` or
`CATEGORY_LABELS` in `lib/docs.ts`.

**Blog.** Add a `.md` or `.mdx` file to `content/blog/` with frontmatter:

```markdown
---
title: Your post title
description: One-line summary for the list view and SEO
date: 2026-04-08
---

Your post body in markdown.
```

Posts are sorted by `date` descending. No draft flag yet — don't commit
posts you haven't finished.

## Where the download links point

`lib/config.ts` exports a single `DOWNLOAD_URL` constant pointing at
`github.com/WalrusQuant/futures-journal/releases/latest`. Every CTA on
the site (hero, nav, pricing, footer, /buy redirect) reads from this
constant — change it in one place if you ever need to.

The `REPO_URL` constant points at the repo root, used by the "View on
GitHub" links.

## Deploying to GitHub Pages

The site builds as a static export (`output: "export"` in `next.config.ts`)
and is published by `.github/workflows/pages.yml`. Pushes to `main` that
touch `site/**` or `docs/**` redeploy automatically; the workflow can also
be triggered manually from the Actions tab.

The site lives at `https://walrusquant.github.io/futures-journal/`, so
`basePath: "/futures-journal"` is set in `next.config.ts`. If you ever
move to a custom domain or rename the repo, update `basePath` and
`SITE.url` together.

One-time setup:

1. Repo Settings → **Pages** → Source: **GitHub Actions**.

`public/.nojekyll` is committed so the deployed artifact serves files
prefixed with `_next/` correctly.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS v4 (CSS-first config, see `app/globals.css`)
- `next-mdx-remote` + `remark-gfm` + `rehype-slug` + `rehype-autolink-headings`
  + `rehype-pretty-code` (Shiki) for MDX rendering
- `gray-matter` for frontmatter
- `next/font` Geist + Geist Mono
- `next/og` for the Open Graph image (see `app/opengraph-image.tsx`)

## What's not here

- Email capture / newsletter
- Testimonials
- Comparison pages vs. other journals
- Analytics — there's a commented placeholder in `app/layout.tsx`.
  Deliberately not installed yet.
