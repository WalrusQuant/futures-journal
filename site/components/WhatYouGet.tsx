const ITEMS = [
  {
    title: "Mac and Windows desktop builds",
    body: "Native desktop app built with Tauri 2. Direct download from GitHub Releases. One binary per platform, no installer tricks.",
  },
  {
    title: "The full knowledge base",
    body: "Getting started, concepts, guides, and FAQ — the same knowledge base mirrored on this site, shipped with the app.",
  },
  {
    title: "MIT-licensed source",
    body: "The whole repo is on GitHub. Read it, fork it, audit it, ship a patch. The license file in the repo is the canonical word.",
  },
  {
    title: "Your data on your disk",
    body: "A single SQLite file on your machine. Automatic daily JSON backups with 14-day rolling retention. Nothing ever leaves the machine.",
  },
  {
    title: "No account, no login, no telemetry",
    body: "No email verification, no cloud sync, no usage statistics, no crash reporter. The app works offline, and only ever worked offline.",
  },
  {
    title: "Privacy mode",
    body: "One setting in Settings masks every dollar amount in the app — useful for screen-sharing, screenshots, or working in public. Applied at bootstrap before the first render, so raw amounts don't flash on screen.",
  },
];

export function WhatYouGet() {
  return (
    <section className="container-page py-20">
      <div className="max-w-2xl mb-12">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          What you get
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-lg border border-[var(--color-border)] p-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              <div>
                <div className="font-medium text-[var(--color-text)]">
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                  {item.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
