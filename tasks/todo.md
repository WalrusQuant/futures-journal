# Phase 9 — Ship v1.0 for sale

## Context

Selling the app as a one-time $29 desktop download under the personal brand at `adamwickwire.com`. Specifically on a **subdomain** (main site is Next.js on Vercel, so a separate deployment or a new Vercel project wired to a subdomain under the same DNS). Positioning: "tool I built for my own prop trading, finally cleaned up enough to sell a copy." Honest, first-person voice. No separate brand identity.

Zero new spend beyond LLC. Binaries ship **unsigned** with an in-page walkthrough of how to bypass the Mac Gatekeeper and Windows SmartScreen warnings. Signing defers to post-launch once demand is proven.

**Payment processor: Lemon Squeezy** (Merchant of Record). Chosen specifically to eliminate sales-tax compliance — Wisconsin taxes prewritten software delivered electronically, and going direct via Stripe would require a WI seller's permit + ongoing quarterly filings + EU VAT exposure on any international sale. LS handles all of that as the legal seller. ~5% + 50¢ per transaction (~$1.95 on a $29 sale → ~$27.05 net) vs. ~$1.64 net cost on Stripe + Stripe Tax — the 31¢ delta is a no-brainer for eliminating recurring tax admin. Stripe stays for unrelated consulting income, completely separate.

Buyer experience: land on subdomain → read the backstory → watch a 30-second video of the risk engine blocking a trade → click Buy → Lemon Squeezy hosted checkout → pay → LS sends a receipt email with download links and (optionally) a license key → install (one-time warning bypass) → first-run empty state guides them.

**Hard constraint: launch in ~1 week of focused work, no open-ended polishing.**

## Decisions the user still has to make

- [ ] **Name.** Current working name is "Futures Journal" (in `tauri.conf.json`). Literal + simple is fine since the brand is the personal name. Top candidates: `Futures Journal`, `Prop Journal`, `Prop Rules`. Pick one before landing page copy is written.
- [ ] **Subdomain.** `journal.adamwickwire.com` / `futures.adamwickwire.com` / `propjournal.adamwickwire.com` / `tools.adamwickwire.com`. Whatever matches the name decision.
- [ ] **Launch price.** $29 locked, OR $29 with 72h `LAUNCH` promo at $19. Default to the promo — costs nothing and creates urgency.
- [ ] **Refund window.** 14 days, no questions. (Recommended — matches indie norm and matches Lemon Squeezy's default refund flow.)
- [x] **Payment processor: Lemon Squeezy** (decided). Stripe reserved for separate consulting work. ~~Stripe direct + Stripe Tax + WI seller's permit~~.
- [ ] **Icon.** DIY in Figma vs Fiverr ($20–50, 24h turnaround). Non-blocking for the first build pipeline runs but blocking for a real launch.

---

## 9.1 — Cross-platform build pipeline

**Goal:** every git tag push produces downloadable `.dmg` (macOS universal) and `.msi`/`.exe` (Windows x64) artifacts, unsigned, attached to a GitHub Release.

- [ ] Write `.github/workflows/release.yml` using `tauri-apps/tauri-action@v0`
  - Matrix: `macos-latest` (arm64), `macos-13` (x64, for intel compatibility — or skip and ship arm-only first), `windows-latest`
  - Trigger: `push` to tags matching `v*`
  - Produces a draft GitHub Release with artifacts attached
- [ ] Test by pushing `v0.9.0-test` tag — confirm both artifacts build and download
- [ ] Install the Mac `.dmg` on a real Mac. Verify the app launches after the Gatekeeper bypass dance. Screenshot the warning for the install guide.
- [ ] Install the Windows `.exe` on a real Windows machine (or Azure VM / Parallels / friend's laptop). Verify the app launches after SmartScreen "Run anyway." Screenshot the warning for the install guide.
- [ ] Fix anything that breaks (icons, bundle identifiers, Tauri plugin configs)
- [ ] Confirm the DB migration 001 → 009 runs cleanly on a fresh install (no existing DB file)

**Out of scope for this phase:** code signing, notarization, auto-updater. All deferred.

---

## 9.2 — App polish for v1.0

**Goal:** the app is presentable to a paying stranger on first run. No new features — only the rough edges a new user will hit.

- [ ] **Rename** (if changing from "Futures Journal"). Update `tauri.conf.json` `productName` + the window title + `package.json` name + any hardcoded references in the UI. Identifier (`com.adamwickwire.futuresjournal`) can stay — it's a stable reverse-DNS string and doesn't need to match the display name.
- [ ] **Version bump** to `1.0.0` in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- [ ] **Icon set.** Tauri generates all platform sizes from one square PNG: `cargo tauri icon path/to/1024.png`. Replace the default Tauri logo. Commit the generated icons.
- [ ] **First-run empty state.** When `listAccounts()` returns empty on the Dashboard, render a welcome card instead of the blank Today panel: "Welcome. Start by creating your first account → [Accounts]". Same treatment on the Accounts list page.
- [ ] **About screen.** Add an "About" row in the Settings sidebar. Shows: app version, migration version, DB file path, link to the sales page, copyright line, "made by Adam Wickwire" credit. Keep it tiny — <40 lines of markup.
- [ ] **Empty-state audit.** Walk every list/table route and confirm there's a friendly empty state, not a blank card:
  - Trades list, Plans list, Calendar, Tags, Analytics (already has this), Ledger (already has this), Transactions list on account detail
- [ ] **Error message audit.** Grep for `throw new Error(` and `alert(` in `src/pages/` and `src/lib/`. Every user-facing error should be a sentence, not a stack trace fragment.
- [ ] **Export + restore smoke test.** Back up a dev DB with real data via Settings → Backup. Wipe `futures-journal.db`. Relaunch the app (runs migrations clean). Restore from the backup file. Confirm everything is exactly as it was. This is the single most important pre-launch test — the "your data is yours" claim must hold.
- [ ] **Privacy mode sanity check.** Turn it on, navigate every page, confirm no dollar values leak through. Especially in the new Ledger page, risk panel, and dashboard stat tiles added in Phases 7–8.
- [ ] **First-account onboarding hint.** In the new-account modal for a brand new install, default-select `sim_funded` and show a one-liner help text: "Pick your account type. You can reclassify any time." Already there for category but may need tightening.

**Out of scope:** keyboard shortcuts, accessibility beyond what already exists, visual redesign, any new features.

---

## 9.3 — Sales subdomain on Vercel

**Goal:** `<subdomain>.adamwickwire.com` resolves to a single Next.js page in first-person voice, with a Buy button that hits Stripe.

- [ ] **New Next.js project** (or a new route + vercel.json rewrite on the existing main site — decide based on how isolated you want deployments). Recommendation: separate project, keeps the main site deploy cadence independent of product updates.
- [ ] **Wire the subdomain** in Vercel → Domains. Add the CNAME in your DNS provider. TTL low during setup in case DNS needs fixing.
- [ ] **Content sections** (one page, long-scroll, anchor nav):
  - [ ] **Hero** — first-person pitch in ~40 words. "Hey, I'm Adam. I trade futures on prop firm accounts. I built this because every journal I tried was built for stock traders and none of them could enforce an Apex trailing drawdown. After six months of using it myself, I'm selling a copy. $29, Mac or Windows, yours forever." Buy button + one screenshot.
  - [ ] **The demo** — 30-second silent looping video of the risk engine blocking a trade that would breach drawdown. Autoplay, muted, no controls. This is the killer moment.
  - [ ] **Why I built it** — 3 paragraphs of authentic backstory. Name the competitors (Tradezella, Edgewonk, TraderSync) and what was missing. No bashing, just honest frustrations.
  - [ ] **What it does** — feature list with inline screenshots. Lean on the structure already in `README.md` — Accounts / Trades / Risk Engine / Ledger / Analytics / Dashboard. One screenshot per feature minimum.
  - [ ] **How I actually use it** — a paragraph or two of your own workflow with the app on your real accounts. Screenshot with privacy mode on.
  - [ ] **Who this is for / not for** — radically honest. Futures only. Prop firm focused. Mac/Win only. One-person support. Not for stocks or crypto. Not for teams.
  - [ ] **Pricing** — $29 one-time, lifetime access, updates for 1 year via email notification (no auto-updater yet). Promo banner if running the `LAUNCH` code.
  - [ ] **Install walkthrough (first-run warnings)** — screenshots of the Mac Gatekeeper dialog and the Windows SmartScreen dialog, with annotated arrows showing exactly where to click. Explain *why* (not a big company, not paying $200/yr for certs, signing will come later). Honest framing.
  - [ ] **FAQ** — 8–10 Qs. Sample set: What does it actually do? Is my data private? Does it work offline? (yes, always) Do I get updates? (free updates for the first year via email) What if I stop getting updates? (SQLite file is yours forever, export works) Can I get a refund? (14 days, no questions) Why is it unsigned? Will you add [feature]? (maybe, email me) What platforms? Does it sync to my broker? (not yet, v1 is manual/CSV import coming)
  - [ ] **About me + other tools** — short bio, photo, link back to `adamwickwire.com`. Stub section for future tools.
  - [ ] **Footer** — terms link, privacy link, refund policy link, support email
- [ ] **Legal pages** (can be on the same subdomain, separate routes):
  - [ ] `/terms` — generate from a SaaS template (Termly, Iubenda) and trim
  - [ ] `/privacy` — note that the app itself collects nothing, but the website uses Plausible/PostHog analytics and Stripe for payment
  - [ ] `/refund` — 14 days, no questions, refund via Stripe direct
- [ ] **Analytics** — drop Plausible or PostHog onto the page. Do NOT use Google Analytics — it contradicts the "local-first / privacy-respecting" positioning.
- [ ] **Favicon + OpenGraph/Twitter meta tags** — a single OG image showing the dashboard screenshot with the app name overlaid. Social sharing matters for indie launches.

---

## 9.4 — Lemon Squeezy + fulfillment

**Goal:** buyer clicks Buy → pays via LS hosted checkout → gets download links + license key within 30 seconds. Zero sales-tax compliance work because LS is the Merchant of Record.

- [ ] **Sign up for Lemon Squeezy** at lemonsqueezy.com. Free, ~10 minutes. Connect bank account for payouts (monthly).
- [ ] **Create a Store** in the LS dashboard. Store name = your brand name (e.g. "Adam Wickwire Tools" or just your personal brand). Store handle becomes part of the checkout URL.
- [ ] **Create the Product.**
  - Type: **Single Payment** (not subscription)
  - Name: `[Product name] — Lifetime License`
  - Price: `$29.00 USD` (or whatever you settle on)
  - Description: short pitch + version note
  - Variant: just the one default variant
- [ ] **Enable License Keys on the product.** Free, built-in. LS will auto-generate a unique key per purchase and include it in the receipt email. You don't have to wire validation in the app for v1 (honor system) — but the keys exist if you ever want to add it later. Configure: `Number of activations: 1`, `Expires: never`.
- [ ] **Configure the receipt email** in LS Settings → Emails. Customize the body to include: "Thanks for buying [Product]. Download links: [Mac] [Windows]. First-run install instructions: [link to subdomain install section]. Your license key (save this): {license_key}. Reply to this email for support — it goes to me directly." LS supports template variables.
- [ ] **Configure tax handling.** In Settings → Tax. Confirm "Lemon Squeezy collects and remits tax" is enabled (this is the default for MoR mode). No further action — LS auto-detects buyer location, applies the right rate, files the returns. You owe nothing, file nothing, register for nothing.
- [ ] **Host the binaries.** Pick one:
  - **GitHub Releases** (free, public URLs, already integrated with the 9.1 pipeline) — simplest. The Mac and Windows assets uploaded by the GH Action are directly linkable; just paste those URLs into the LS receipt email.
  - **Cloudflare R2** ($0 up to 10 GB egress, cleaner URLs, worth it if you don't want the binaries visible on a public GitHub Releases page). Upload manually or wire a script.
  - **LS file delivery** — Lemon Squeezy can host the files itself and serve them only to verified buyers via the Customer Portal. More secure but adds an upload step on every release. **Recommended if you care about controlling distribution.**
- [ ] **Decide where the buyer lands post-purchase.** Two options:
  - **Option A (simplest):** Configure LS to redirect to `<subdomain>/thanks` after checkout. That page is a static "Thanks for buying! Your download links and license key are in the receipt email — check your inbox. If you don't see it, check spam, or email me." No session validation needed.
  - **Option B (slicker):** Build a `<subdomain>/thanks?order_id=...` page that calls LS's API to fetch order details server-side and shows the download links + license key inline. More work, slightly nicer UX. Defer to post-launch unless you've already got time.
- [ ] **Embed checkout on the sales page.** LS supports two modes:
  - **Hosted checkout:** the Buy button is just a link to `https://[your-store].lemonsqueezy.com/buy/[variant-id]`. Opens in a new tab. Zero JS needed.
  - **Overlay checkout:** drop the LS overlay JS snippet on the page; clicking Buy opens the checkout in a modal without leaving your subdomain. **Recommended** — keeps the buyer on your site.
- [ ] **Customer Portal** — LS gives every buyer a free portal to access their license keys, downloads, and invoices. Linked from the receipt email automatically. Zero work to set up. Mention it in the FAQ on the sales page so buyers know they have it.
- [ ] **End-to-end test** — use LS's test mode (separate test products + test card numbers) to simulate the full flow: click Buy → fill checkout → "pay" → receive receipt → click download links → install the app. Confirm everything works. Then flip the product to live mode.

**What this eliminates from the original Stripe plan:**
- ~~Wisconsin seller's permit registration~~
- ~~Stripe Tax setup~~
- ~~Quarterly WI sales tax filings forever~~
- ~~EU VAT exposure on international sales~~
- ~~Manual chargeback dispute paperwork~~
- ~~Building license key issuance from scratch~~ (LS does it free)

---

## 9.5 — Marketing assets

**Goal:** real assets to drop into the landing page and social posts.

- [ ] **Dashboard screenshot** — hero shot. Privacy mode off. Real-ish data (use the Python seeder). 1600×1000 or similar, crisp, no OS chrome.
- [ ] **Risk engine screenshot** — the panel showing a blocker firing. Caption this as "the reason the app exists."
- [ ] **Ledger page screenshot** — the 7 totals tiles plus the real-money curve.
- [ ] **Analytics screenshot** — the equity curve plus the R-distribution.
- [ ] **Mobile-responsive images** — same content, portrait crop, for landing on phones.
- [ ] **30-second demo video** — screen recording (QuickTime or OBS), no audio, shows:
  1. Open the trade form on a sim-funded account
  2. Start filling in a trade that will breach the drawdown floor
  3. Risk panel turns red, blocker appears: "Stop-out would put the account below its trailing drawdown floor"
  4. Fade out with the pitch line
  Export as MP4 (h.264), under 5 MB, loopable.
- [ ] **One-sentence taglines** (3 variants to A/B in the launch post):
  - "The futures journal that blocks trades that would break your prop firm's rules."
  - "A journal I built for my own prop trading, because none of the existing ones could enforce a trailing drawdown."
  - "Stop-out protection for futures traders. $29, yours forever, runs on your own machine."

---

## 9.X — User-facing knowledge base (Phase 1)

**Goal:** ship v1.0 with a real, in-repo knowledge base at `docs/` that explains how to install, set up, and use the app — including the things that confuse new users (the two-ledger model, how to log a scale-out, configuring firm rules). Portable to a docs subdomain when the marketing site is built.

- [x] Plan written: `~/.claude/plans/cheeky-jumping-kahn.md`
- [x] Spike: `docs/README.md`, `docs/getting-started/quickstart.md`, `docs/concepts/the-two-ledgers.md`
- [ ] Phase 1 fill-in: 24 remaining files across `getting-started/`, `concepts/`, `guides/`, and `faq.md` (~27 files total at Phase 1 completion)
- [ ] Update root `README.md` to link to `docs/`
- [ ] Update `CLAUDE.md` to note `docs/` exists for future Claude sessions
- [ ] Cold-read test: open `docs/getting-started/quickstart.md` as a brand-new user and walk through it. Every label and step should match the live app.
- [ ] Scale-out walkthrough test: follow `docs/guides/logging-a-scale-out-trade.md` against the Tradeify MES trade. Math should match what Tradeify shows.

**Phase 2 (deferred, post-launch):** the `docs/reference/` tree — every page, form, field, URL parameter, keyboard shortcut, instrument, drawdown combination. Written after real customers expose what needs the most depth. ~20 files.

---

## 9.6 — Soft launch + first-48h monitoring

**Goal:** put it in front of the narrowest audience most likely to buy, capture signal, fix breakage fast.

- [ ] **Post 1: your own Twitter/X** — the backstory thread. "I trade futures on prop firm accounts. Every journal was built for stock traders. I spent six months building my own that actually enforces my firm's rules. Today I'm selling a copy for $29. [screenshots + video + link]"
- [ ] **Post 2: r/FuturesTrading or r/Daytrading** — **read self-promo rules first** (both subs require a history of non-promotional posts). If you don't have post karma there, ask a friend with karma to share it, or buy nothing — just skip.
- [ ] **Post 3: a prop firm Discord** you're in. Ask the mod first if self-promo is allowed. Frame as "I built this for my own trading, just launched it." Don't link bomb.
- [ ] **Monitor support email** — respond within 4 hours during the first 48h. Bug reports get a "fix incoming" reply and a hotfix release the same day if possible.
- [ ] **Keep a launch log** in `tasks/` — every bug reported, every FAQ question asked, every refund reason. This is data for v1.1 priorities.
- [ ] **Decision point at 72h:** how many sales? What did buyers complain about? Do we invest in signing certs + real marketing next, or pivot the positioning?

---

## Out of scope for v1.0 (defer, don't block)

- Code signing (macOS Apple Developer Program, Windows cert) — $200+/yr, add only if launch traction justifies it
- Auto-updater (requires signed packages on macOS anyway) — use email notifications for updates
- License key validation in the app — honor system at v1, but LS issues keys per purchase for free, so adding validation later is a one-API-call change
- CSV broker import (Tradovate, NinjaTrader exports) — v1.1 candidate, most-requested feature likely
- Direct broker API sync (Tradovate REST, etc.) — v1.5+, months away
- Subscription tier for continuous data sync — v2+, proves the one-time sale first
- Linux builds — skip entirely unless a paying customer specifically asks
- A real docs **site** (separate domain, hosted) — Phase 1 of the KB ships in-repo at `docs/` and is portable to a subdomain whenever wanted; standing up the actual subdomain is the marketing-site work
- **Phase 2 of the KB** — exhaustive `docs/reference/` (every page, form, field, URL param). Defer until post-launch when real customer questions can inform what to write. Phase 1 (concepts + guides + FAQ) is sufficient for v1.0 — see `docs/README.md`
- Affiliate program — LS has it built in for free, but enable only if a relevant prop-firm influencer expresses interest
- Community (Discord, forum) — reactive support email only at this stage; communities are overrated pre-PMF
- Teams / multi-user / cloud sync — the "local-first, yours forever" positioning is the whole point, don't dilute it

---

## What Claude can do next (pick any when you come back)

When you pick this back up, here's what I can execute against this plan without needing additional clarification:

1. **Write the GitHub Actions `release.yml` workflow** for cross-platform builds (9.1). ~1 hour, produces a working unsigned build pipeline.
2. **Draft the full first-person sales page copy** for the subdomain (9.3). I'll fill in placeholders where real screenshots / video / backstory specifics need your input.
3. **Audit the app for v1.0 polish items** (9.2). I'll grep, read, and produce a concrete checklist of every empty state, error message, and first-run rough edge so you can chew through it.
4. **Scaffold the new Next.js project** for the subdomain (9.3). Hero, features, FAQ, legal routes, Plausible wired, OG image tags, Tailwind or plain CSS depending on your preference.
5. **Write the Lemon Squeezy fulfillment flow** — either the simple `/thanks` static page or the slicker `/thanks?order_id=...` page that calls the LS API server-side to render download links + license key inline (9.4).
6. **Draft the launch post copy** for Twitter / Reddit / Discord (9.6).

Pick one and we can go. Default recommendation if you're unsure: start with #1 (build pipeline) because everything else depends on having real binaries in hand.

---

# Phase 8 — Real money ledger & account categories

Five sub-phases, ordered so each one ships independently and the app is in a working state after each commit:

1. **Account categories + rule-engine compat** (this file, below) — adds `category` column, no behavior change to rules
2. **Bank account + linked transfers** — new `bank` category, paired transfer entries, recompute handles them
3. **Real-money ledger computation + Ledger page** — pure functions + new sidebar entry
4. **Analytics page segmentation** — view-mode pill, category filter, include-archived toggle
5. **Dashboard updates** — net-real headline stat, archived-filter respect

---

## Phase 8.1 — Account categories + rule-engine compat

**Context:** Right now `accounts.type` is only `funded` or `cash`, which conflates combine, sim-funded, and live-funded into one bucket. Analytics and the coming real-money ledger need a finer distinction. This phase adds a `category` column (`combine` / `sim_funded` / `live_funded` / `cash`) without breaking the existing rule engine, which reads `type` and will continue to do so.

The `bank` category is NOT introduced in this phase — it comes in 8.2 alongside transfers, because a bank account without transfers is useless.

**Migration `008_account_category.sql`** (register in `src-tauri/src/lib.rs`)

```sql
-- Granular account category. `type` stays as funded|cash for the existing
-- rule engine (risk.js, computeHeadroom, computeDrawdownFloor); `category`
-- is additive and used by analytics + the upcoming ledger.
--
-- Existing rows: type='funded' defaults to 'sim_funded' (the most common
-- active state — user will re-label combines and live-funded accounts via
-- the edit form). type='cash' maps 1:1 to 'cash'.
ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'sim_funded'
  CHECK (category IN ('combine','sim_funded','live_funded','cash'));
UPDATE accounts SET category = 'cash' WHERE type = 'cash';
UPDATE accounts SET category = 'sim_funded' WHERE type = 'funded';
```

Note: `bank` is intentionally omitted from the CHECK until Phase 8.2. When we add it, it'll be a second `ALTER TABLE` rebuild OR we pre-include it here. Pre-including keeps us from a table rebuild later — I'll include `bank` in the CHECK now even though nothing creates bank accounts in this phase.

Amended CHECK: `category IN ('combine','sim_funded','live_funded','cash','bank')`.

**`src/lib/accounts.js`**

- Add `ACCOUNT_CATEGORIES` const (ordered for UI display):
  ```js
  export const ACCOUNT_CATEGORIES = [
    { value: "combine",     label: "Combine / Evaluation", type: "funded", desc: "Simulated trades, pay monthly sub. Failing archives it." },
    { value: "sim_funded",  label: "Sim funded",           type: "funded", desc: "Simulated trades, real payouts. Rules still enforced." },
    { value: "live_funded", label: "Live funded",          type: "funded", desc: "Real fills with firm capital. P&L only hits real ledger on withdrawal." },
    { value: "cash",        label: "Cash brokerage",       type: "cash",   desc: "Your own money at a real broker. No prop-firm rules." },
    // { value: "bank", ... } — reserved for Phase 8.2
  ];
  ```
- `createAccount`: accept `data.category`, derive `type` from the category's mapping in `ACCOUNT_CATEGORIES` (so the form only needs to set `category` and we guarantee they stay in sync). Insert both columns.
- `updateAccount`: whitelist `category`. When category changes, also update `type` derived from the category. Keep the rule-engine fields untouched.
- Helper `categoryDef(value)` → returns the ACCOUNT_CATEGORIES row or null.
- No changes to `computeDrawdownFloor` / `computeHeadroom` / `loadAccountRiskContext` — they all read `type`, which stays correct.

**`src/pages/accounts.js`**

- Form: replace the funded/cash radio pair with a `<select>` driven by `ACCOUNT_CATEGORIES`. Help text updates live from the category's `desc`, same pattern as the existing drawdown-mode help.
- Form `data-show-when="funded"` / `data-show-when="cash"` sections: change to key off category. Rules section (drawdown, DLL, etc.) shows when `categoryDef(category).type === 'funded'`. Cash section shows when `type === 'cash'`. Implementation: set `form.dataset.accountType = categoryDef(category).type` whenever the category select changes.
- Form submit: send `data.category` (not `data.type`); `createAccount`/`updateAccount` derive type. Cash accounts still null out the rule fields same as today.
- Initial state for new accounts: `category: "sim_funded"`.
- Detail view: add a "Category" row at the top of the Rules card showing the human-readable label.
- List view (`rowHtml`): category badge replaces or augments the existing `type` badge. For phase 1, keep it simple — show the category label in the subtitle row.

**`src/pages/dashboard.js`**

- No functional changes in this phase. Today cards still render for every active account regardless of category (per the `feedback_safety_visibility` memory — default to inclusion).

**Files to modify**

- `src-tauri/migrations/008_account_category.sql` (new)
- `src-tauri/src/lib.rs` (register migration 8)
- `src/lib/accounts.js` (ACCOUNT_CATEGORIES const, category in create/update, categoryDef helper)
- `src/pages/accounts.js` (form dropdown, live help, detail row, list badge)

**Verification**

1. `npm run build` — zero errors
2. `cargo check` — zero errors
3. Quit + relaunch `npm run tauri dev` so migration 008 runs
4. Manual: open any existing funded account → should show "Sim funded" as the category. Edit and change to "Combine" → save → reload page → still "Combine".
5. Manual: create a new account with each of the four categories. Confirm:
   - combine/sim_funded/live_funded: rules section shows, cash section hidden
   - cash: cash section shows, rules section hidden
6. Manual: confirm the existing risk engine still blocks trades correctly on a sim_funded account (re-test the drawdown blocker we built in phase 7).
7. Inspect DB: `sqlite3 <path-to-futures-journal.db> "SELECT name, type, category FROM accounts;"` — every row has a non-null category, type matches category's mapping.

**Commit point:** "Phase 8.1: account categories (combine / sim_funded / live_funded / cash)"

**Out of scope for 8.1**

- Bank account type (Phase 8.2)
- Transfers (Phase 8.2)
- Any analytics or ledger changes (Phase 8.3–8.5)
- Renaming or dropping the `type` column — kept for backward compat with the rule engine

---

# Phase 7 — Review, Guardrails, Depth, Safety

Five features, ordered for safety and dependency:

1. **Backup safety first** — before any schema changes
2. **Risk guardrails** — independent, high behavioral value
3. **Trade review loop** — needs migration 004
4. **Plan→trade polish** — small additions
5. **Analytics depth** — biggest surface, builds on everything

---

## Feature 5 — Backup / Data Safety (FIRST for safety)

Current state: `dumpDb()` / `restoreDb()` in `src/lib/export.js` exist and work; settings page has buttons. Missing: auto-backup on launch, retention, and a visible "last backup" status.

- [ ] Add auto-backup on app launch
  - [ ] Add Tauri command `app_data_path()` (or reuse `app_data_dir`) so JS can resolve `<app_data>/backups/` without hardcoding `~/Library/...`
  - [ ] In `main.js::bootstrap()`, after settings load, fire-and-forget an auto-backup call (don't block first render)
  - [ ] Write `<app_data>/backups/backup-YYYY-MM-DD.json` (one per day, idempotent — skip if today's file exists)
  - [ ] New lib: `src/lib/backup.js` with `autoBackup()`, `listBackups()`, `pruneBackups(keepN)`
  - [ ] Prune: keep last 14 daily backups
- [ ] Settings page: show "Last auto-backup: <date>" and a "Backup now" button distinct from the existing JSON export
- [ ] Settings page: list existing backups with restore/delete buttons
- [ ] Add a Rust command `list_dir(path)` scoped to the backups dir (same canonicalized-path sandbox pattern as `delete_image`)

**Commit point:** "Phase 7.1: auto-backup on launch + backup management UI"

---

## Feature 3 — Risk Guardrails on Trade Entry

Current state: `accounts.daily_loss_limit`, `max_contracts`, `trailing_dd`, `profit_target` all stored but never checked. `computeHeadroom(account)` exists but `dailyRoom` is literally the limit column, not "limit minus P&L today". Trade form validates shape but not risk.

- [ ] New `src/lib/risk.js` module — pure functions, no DOM:
  - [ ] `dailyPnlSoFar(accountId, dateISO)` — sum `pnl_dollars` of trades closed today
  - [ ] `openRiskExposure(accountId)` — sum of `tradeRisk().dollars` across open trades
  - [ ] `evaluateTradeRisk({ account, instrument, proposedTrade, dailyPnl, openExposure })` returns `{ warnings: [], blockers: [] }` with checks:
    - proposed dollar risk + openExposure > daily_loss_limit (blocker)
    - contracts + open contracts on same instrument > max_contracts (blocker)
    - proposed risk alone > 50% of daily_loss_limit (warning)
    - balance - proposed risk < (start - trailing_dd) on funded accounts (blocker)
    - dailyPnl already negative and proposed risk pushes past limit (blocker)
    - proposed risk > 2% of account size (warning — classic sizing check)
- [ ] Wire into trade form (`src/pages/trades.js`):
  - [ ] Compute live preview panel under the form: "Risk: $X | Daily used: $Y of $Z | Exposure: $A"
  - [ ] On submit: if blockers, show modal requiring explicit override checkbox; if only warnings, show inline yellow banner but allow submit
  - [ ] Update preview on every input change (debounced)
- [ ] Dashboard widget: "Today's risk budget" card — shows daily P&L, daily loss limit, % used, with color state
- [ ] Add `risk_override` nullable text column to `trades` (migration 005) so overrides are recorded for review

**Commit point:** "Phase 7.2: pre-trade risk guardrails + daily budget widget"

---

## Feature 1 — Trade Review / Post-Trade Journaling

Current state: `trades.notes` + `confidence` + tags. No structured review. No "needs review" queue.

- [ ] **Migration 004** — `src-tauri/migrations/004_trade_review.sql`:
  ```sql
  ALTER TABLE trades ADD COLUMN review_completed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE trades ADD COLUMN plan_followed INTEGER; -- nullable bool
  ALTER TABLE trades ADD COLUMN exit_discipline INTEGER; -- 1-5
  ALTER TABLE trades ADD COLUMN emotional_state TEXT; -- calm/neutral/anxious/angry/overconfident
  ALTER TABLE trades ADD COLUMN lessons TEXT;
  ALTER TABLE trades ADD COLUMN reviewed_at TEXT;
  CREATE INDEX idx_trades_review ON trades(review_completed);
  ```
  - [ ] Register in `src-tauri/src/lib.rs` migrations vec (version 4)
- [ ] **Migration 005** — `005_trade_risk_override.sql` for the risk override column (if phase 7.2 hasn't already)
- [ ] Extend `src/lib/trades.js`:
  - [ ] `setReview(tradeId, { plan_followed, exit_discipline, emotional_state, lessons })` — sets `review_completed=1`, `reviewed_at=now`
  - [ ] `listTradesNeedingReview(accountId?)` — closed trades where `review_completed=0`
- [ ] Trade detail page (`src/pages/trades.js`):
  - [ ] New "Review" card, collapsed by default if `review_completed=0`
  - [ ] Form: plan_followed Y/N toggle, exit_discipline 1–5 stars, emotional_state dropdown, lessons textarea
  - [ ] "Mark reviewed" button
  - [ ] Only visible for closed trades
- [ ] Dashboard widget: "Trades needing review" — count + quick link; only closed trades count
- [ ] Analytics: add "review coverage" stat (% of closed trades reviewed)

**Commit point:** "Phase 7.3: structured trade review + needs-review queue"

---

## Feature 2 — Plan → Trade Linkage Polish

Current state: most of it works. Missing: analytics split, dashboard widget, soft friction on unplanned trades.

- [ ] `src/lib/analytics.js`: add `groupByPlannedStatus(trades)` → `{ planned: {...summary}, unplanned: {...summary} }`
  - [ ] Expose on analytics page as a small two-card comparison
- [ ] Dashboard: "Active plans waiting" widget — count of `plans.status='active'` with a link to `/plans`
- [ ] Trade form soft friction: if `plan_id` is null and account is funded, show an amber notice "Logging an unplanned trade. Consider creating a plan first." Non-blocking.
- [ ] Analytics filter chip: "Planned only / Unplanned only / All"

**Commit point:** "Phase 7.4: planned-vs-unplanned analytics + friction"

---

## Feature 4 — Analytics Depth

Current state: summary, equity curve, instrument breakdown, tag breakdown, R-distribution. Missing: per-tag expectancy, day-of-week, time-of-day, streaks, per-account breakdown. `groupByDay()` is dead code — repurpose it.

- [ ] `src/lib/analytics.js` additions:
  - [ ] Extend `groupByTag()` to include `expectancy` per tag (avg R)
  - [ ] `groupByAccount(trades)` — same shape as instrument breakdown
  - [ ] `groupByHourOfDay(trades)` — bucket by entry_time hour 0–23, return P&L + count + win rate
  - [ ] `groupByDayOfWeek(trades)` — Mon–Fri (futures don't trade weekends), same shape
  - [ ] `computeStreaks(trades)` — longest win streak, longest loss streak, current streak, streak direction
  - [ ] `reviewCoverage(trades)` — % reviewed (ties into feature 1)
- [ ] `src/components/charts.js` additions:
  - [ ] `heatmap(grid, opts)` — 2D SVG heatmap, signed values (green/red diverging). Small — <80 lines.
- [ ] `src/pages/analytics.js` new sections:
  - [ ] "Day of week" bar chart (reuse `barChart`)
  - [ ] "Time of day" heatmap or bar (start with bar, easier)
  - [ ] "Streaks" stat tiles
  - [ ] "Per account" breakdown table
  - [ ] "Review coverage" stat tile
  - [ ] "Tag expectancy" column added to existing tag table
- [ ] Keep filters consistent — all new breakdowns respect account/instrument/date filters

**Commit point:** "Phase 7.5: analytics depth (streaks, time-of-day, expectancy, per-account)"

---

## Scope notes

- **NOT doing in this phase:** MAE/MFE (requires intraday data capture, out of scope). Cloud sync. Candlestick charts. Multi-select filters on analytics.
- **Schema changes:** two migrations (004 review, 005 risk override).
- **Testing:** no test runner exists; manual verification via the seed script + UI walkthrough for each commit point.
- **Commit cadence:** one commit per feature (5 total), each independently runnable.

## Review
_(fill in after each feature lands)_
