// GitHub Pages serves this repo at /futures-journal — keep this in sync
// with `basePath` in next.config.ts. Used for hand-rolled URLs that
// Next's <Link> / asset pipeline doesn't auto-prefix (favicon metadata,
// rewritten markdown links, etc.).
export const BASE_PATH = "/futures-journal";

export const SITE = {
  name: "Futures Journal",
  url: "https://walrusquant.github.io/futures-journal",
  tagline:
    "An opinionated, local-first journal I built for my own prop-firm trading — now you can buy it.",
  author: "Adam Wickwire",
  authorUrl: "https://adamwickwire.com",
};

export const PRICING = {
  regular: 149,
  launch: 59,
  launchSeatsTotal: 100,
  currency: "USD",
};

// Swap this by setting NEXT_PUBLIC_CHECKOUT_URL in Vercel env when the real
// Lemon Squeezy checkout exists. The /buy route and every CTA on the site
// read this one constant.
export const CHECKOUT_URL =
  process.env.NEXT_PUBLIC_CHECKOUT_URL ??
  "https://checkout.lemonsqueezy.com/buy/placeholder";

// Set to false if/when the launch seats sell out and the regular price kicks in.
export const LAUNCH_ACTIVE = true;
