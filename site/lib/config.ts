// GitHub Pages serves this repo at /futures-journal — keep this in sync
// with `basePath` in next.config.ts. Used for hand-rolled URLs that
// Next's <Link> / asset pipeline doesn't auto-prefix (favicon metadata,
// rewritten markdown links, etc.).
export const BASE_PATH = "/futures-journal";

export const SITE = {
  name: "Futures Journal",
  url: "https://walrusquant.github.io/futures-journal",
  tagline:
    "An opinionated, local-first journal I built for my own prop-firm trading — free and open source.",
  author: "Adam Wickwire",
  authorUrl: "https://adamwickwire.com",
};

// Direct link to the GitHub Releases page where Mac/Windows installers live.
// Every CTA on the site points at this single constant.
export const DOWNLOAD_URL =
  "https://github.com/WalrusQuant/futures-journal/releases/latest";

export const REPO_URL = "https://github.com/WalrusQuant/futures-journal";
