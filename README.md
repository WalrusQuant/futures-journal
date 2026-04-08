# Futures Journal

A desktop trading journal for futures traders that runs real prop-firm rule checks against every trade, tracks both your simulated prop accounts and your actual cash flow as two parallel ledgers, and stays entirely local.

`Tauri 2` · `Vanilla JS` · `SQLite` · `Local-only`

<!-- TODO: drop a dashboard screenshot here once the UI stabilizes -->

---

## Table of contents

- [What it is](#what-it-is)
- [Who it's for](#who-its-for)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Common commands](#common-commands)
- [Repository layout](#repository-layout)
- [Data model primer](#data-model-primer)
- [The opinionated bits](#the-opinionated-bits)
- [Privacy mode](#privacy-mode)
- [Migrations and schema evolution](#migrations-and-schema-evolution)
- [Data safety and backups](#data-safety-and-backups)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## What it is

Futures Journal is a purpose-built trading journal for people who trade futures — real brokers, prop firm combines, sim-funded accounts, live-funded accounts — and need to track performance against *actual prop-firm rules* rather than generic "how'd I do this week" metrics.

It is opinionated. The short version:

- **Futures only.** No stocks, no options, no crypto. The math, the validators, and the analytics all assume `point_value × contracts` P&L. Percentage P&L is deliberately absent — it's meaningless when a single tick can be $12.50 or $500.
- **Stops required on every trade.** An entry without a stop isn't a trade, it's a mistake. The form won't let you save one.
- **R-multiples are the primary metric.** Win rate and average R tell you more about a futures strategy than dollar P&L ever will.
- **Plans must have a target.** An entry price without a target isn't a plan, it's a hope.
- **Firm rules live on the account, not in code.** Apex, Topstep, Tradeify, MFFU — they all change their rules every few months. Rather than baking firm logic into the app, Futures Journal models rule *mechanisms* (drawdown modes, lock offsets, contract caps, consistency limits) as generic per-account fields. You configure them once per account and the engine enforces them.
- **Two ledgers, parallel.** One ledger tracks your simulated performance against firm rules on combine / sim-funded / live-funded accounts. The other tracks your actual net worth: cash brokerages, your personal bank, payouts you've received, subscriptions and reset fees you've paid. Both matter, neither contaminates the other.
- **Fully local.** SQLite file on your disk. No accounts to create, no cloud sync, no telemetry. Your trades and P&L do not leave the machine.

## Who it's for

You run one or more prop firm accounts — a combine you're pushing through, a sim-funded account with a monthly sub, maybe a live-funded account you've earned your way into — and you want:

1. A log that actually enforces your firm's drawdown rule (the trailing kind that moves), your daily loss limit, your contract caps (minis vs. micros independently), and your consistency rule — before you take the trade.
2. A clean picture of how much real money you've actually made from all this activity, separate from the simulated P&L inside your funded accounts.
3. A record of what you paid in combine subs and reset fees, tagged to the accounts they covered, so you can tell whether the ecosystem is actually profitable for you.
4. Tags, screenshots, plans, post-trade reviews — the standard journal stuff, just built with futures-first assumptions.

If you're trading equities or crypto, this isn't the tool. If you're running prop accounts and tired of spreadsheets that can't enforce a trailing drawdown, keep reading.

---

## Features

### Accounts

- **Five categories** covering the full futures trader lifecycle:
  - `combine` / `evaluation` — simulated trades, real subscription fees
  - `sim_funded` — simulated trades, real payouts
  - `live_funded` — real fills with firm capital; P&L only hits your real ledger on withdrawal
  - `cash` — your own money at a real broker
  - `bank` — a personal bank account used as the central real-money hub; ledger-only, no trading
- **Per-account rule config.** Every rule is a column on the account row:
  - Drawdown mode (`static`, `eod_trailing`, `intraday_trailing`) plus amount
  - Lock offset (combine = 0, sim-funded = 100, or blank for no lock)
  - Lock on payout/withdrawal (toggle)
  - Daily loss limit
  - Profit target
  - Max minis and max micros — **independent caps**, enforced separately
  - Consistency limit % (best day ≤ N% of total profit)
  - Free-form rules notes (for anything the app doesn't model)
- **Balance recomputation from source.** `current_balance` is always derived from `account_size + Σ(signed transactions) + Σ(closed trade P&L)`. It's never stored independently, so it can't drift.
- **Archive / unarchive.** Failed combines get archived, not deleted — hidden from active analytics by default but reviewable via an "include archived" toggle.

### Trades

- **Opinionated trade form.** Entry, stop, target, contracts, instrument, account. R-multiple computed live from stop distance, dollar P&L computed from `point_value × contracts`. Stops are required.
- **Per-trade risk override.** Sometimes you size off something other than stop distance — a mental stop, a time stop, a size cap. The form accepts a manual risk number when that happens.
- **Plan → trade linking.** When you take a plan, the form pre-fills from it and links the two rows so analytics can attribute the trade back to the plan.
- **Post-trade review loop.** Closed trades land in a "needs review" bucket. You fill in notes, what you did right, what you did wrong, and mark it reviewed. Dashboard surfaces a banner when the bucket is non-empty.
- **Tags.** Four categories: strategy, setup, condition, mistake. Multi-select on every trade.
- **Screenshots.** Drag-drop or paste images onto any trade. Stored in `<app_data>/images/` via a sandboxed Rust command.

### Plans

- **Plans require both stop AND target.** No half-plans.
- **Planned R/R** computed and validated on save.
- **Lifecycle:** `active` → `taken` / `invalidated` / `expired`.
- **Tags and screenshots** on plans too (polymorphic image table).
- **"Take this plan"** one-click pre-fills a new trade form and wires the link.

### Pre-trade risk engine

Runs on every debounced keystroke in the trade form. Two severity levels:

**Blockers** — hard stops. Can be overridden, but the override reason is recorded on the trade so you can review your discipline later.

- **Daily loss limit breach.** Worst case today (realized + all open risk + this trade's risk) vs. the limit.
- **Max minis exceeded.** Checked only when the proposed trade is a mini (`is_micro = 0`).
- **Max micros exceeded.** Checked only when the proposed trade is a micro.
- **Drawdown floor breach.** If this trade's stop hits, would the balance fall below the computed floor? The floor itself depends on the account's drawdown mode:
  - `static` → `start - dd`, never moves
  - `eod_trailing` → `peak(end-of-day equity) - dd`, samples peak only at session boundaries
  - `intraday_trailing` → `peak(running equity after each closed trade) - dd`, honest proxy without tick data
  - Plus lock-at-target: once peak ≥ `start + dd + offset`, floor freezes at `start + offset`
  - Plus lock-on-payout: any withdrawal or payout transaction locks the floor immediately

**Warnings** — soft, just shown in the risk panel:

- Risking more than 2% of account size
- This trade alone risks more than 50% of the daily loss limit

**Consistency rule** (best day ≤ N% of total profit) is evaluated end-of-day and is display-only — it can't meaningfully block individual trades because you don't know what the final-day total will be until the session closes.

**Batched loading.** Dashboards rendering headroom across many accounts use `loadAccountRiskContext` to fetch trades + transactions in exactly two queries regardless of account count — no N+1.

### Real money ledger

A dedicated `/ledger` page that answers one question: **how much actual money have I made from all this?**

- **Range pills:** MTD, QTD, YTD, All time. URL-persisted, so refresh keeps the view.
- **Seven totals tiles:**
  - Net real money (inflows − outflows + cash trading)
  - Deposits (external money into cash or bank accounts)
  - Withdrawals (external money out)
  - Payouts received (the sim → real bridge)
  - Subscription fees (monthly combine / eval subs)
  - Reset + activation (one-time firm costs)
  - Cash trading P&L (real broker accounts only)
- **Running curve.** Cumulative real net worth over time, line chart.
- **Fee burn by account.** For every `fee`/`reset`/`activation` transaction tagged via `paid_for_account_id`, broken out per target account so you can see "my Apex 50k eval has cost me $437 in subs and resets."
- **Chronological event table.** Every real-money event with date, account, kind, category, amount, and detail.
- **No double-counting.** A transfer from a sim-funded account to the bank creates two linked rows (`transfer_out` on the source, `transfer_in` on the destination). The ledger counts it only on the bank side. Transfers *between* two real accounts (bank → cash brokerage) are marked `internal_transfer` and excluded from `totals.net` because they don't change your net worth.

### Analytics

- **View mode pill:** `All activity | Real money | Simulated`. Real mode filters the trade set to cash-category accounts only. Simulated mode filters to combine / sim-funded / live-funded. All-mode is everything.
- **Filters:** account picker, category multi-select, instrument, planned vs. unplanned, date range, "include archived" checkbox (off by default).
- **Widgets:**
  - Summary stats: count, wins/losses/BE, net P&L, win rate, profit factor, avg R, expectancy, avg win, avg loss, best trade, worst trade, avg hold, longest streaks, review coverage
  - Equity curve (cumulative P&L over closed trades in order)
  - R-multiple distribution
  - Day-of-week / hour-of-day breakdowns
  - Planned vs. unplanned side-by-side comparison
  - Per-instrument, per-account, per-tag tables

### Dashboard

- **Today panel, one card per active account.** Cards adapt to whichever rules the account has configured — daily loss limit bar, drawdown room with the mode labeled, mini bar, micro bar, consistency row, profit target bar. Every active account always gets a card; cards with no rules configured just show today's P&L and open risk.
- **Drawdown warnings** banner for any funded account within $750 of its floor.
- **Headline stats:** Today / Week / Month / Real this month (linking to `/ledger?range=mtd`) / Open positions.
- **Equity curve**, recent trades, active plans, "needs review" call-to-action when the review bucket is non-empty.

### Calendar

- Monthly grid of closed trades, each day color-coded by net P&L.
- Account filter via URL param.
- Month navigation.

### Tags

- CRUD across four categories: `strategy`, `setup`, `condition`, `mistake`. Each tag has a color.
- Joined to trades via `trade_tags`, to plans via `plan_tags` (migration 003).

### Settings

- **Default account** for new trades and plans
- **Week starts on** Sunday or Monday
- **Privacy mode** — masks dollar amounts app-wide for screenshots
- **Export:** CSV for trades and plans
- **Backup:** JSON dump + restore (transactional, rolls back on failure)
- **Auto-backup management:** view the list of automatic backups, restore any of them, delete individually
- **Diagnostics:** app version, DB path, migration version

### Data safety

- **Automatic daily backup** at launch, idempotent — one per calendar day, skipped if today's file already exists.
- **Retention:** 14 most recent auto-backups kept. Manual backups are never auto-pruned.
- **Storage:** `<app_data>/backups/`, sandboxed on the Rust side via canonicalized path checks so file commands can't escape the backup directory.
- **Transactional JSON restore** — a failed restore rolls back instead of leaving the DB half-applied.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JavaScript (ES modules, `"type": "module"`), no framework, no bundled UI lib |
| Build | Vite 5.4 (`root: "src"`, outputs to `dist/`) |
| Desktop shell | Tauri 2 |
| Tauri plugins | `tauri-plugin-sql` (SQLite), `tauri-plugin-dialog`, `tauri-plugin-opener` |
| Frontend Tauri bindings | `@tauri-apps/api` ^2, `@tauri-apps/plugin-sql` ^2, `@tauri-apps/plugin-dialog` ^2.7.0 |
| Database | SQLite, forward-only numbered migrations (currently at version 9) |
| Backend language | Rust (stable toolchain) |

**App identity**

- Package: `com.adamwickwire.futuresjournal`
- Product name: `Futures Journal`
- Default window: 1280×800, minimum 1024×640
- `withGlobalTauri: true`

**Data location** (macOS example):

```
~/Library/Application Support/com.adamwickwire.futuresjournal/
├── futures-journal.db        # main SQLite database
├── backups/                  # auto + manual JSON backups
└── images/                   # trade/plan screenshots
```

Windows and Linux use the platform-equivalent app data directory.

---

## Prerequisites

- **Node.js** ≥ 18 (for Vite)
- **Rust toolchain** via [rustup](https://rustup.rs/)
- **Platform Tauri prerequisites** — follow the official [Tauri prerequisites guide](https://tauri.app/start/prerequisites/) for your OS
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Python 3** — optional, only needed if you want to run the seed script

---

## Getting started

```sh
git clone <your-fork-or-upstream-url> futures-journal
cd futures-journal
npm install
npm run tauri dev
```

The first launch will:

1. Build the Rust backend (slow the first time, cached after)
2. Start Vite on port 1420
3. Open the desktop app window
4. Run all migrations (1–9) to create `futures-journal.db` at the app-data path

Once the app is up:

1. Go to **Accounts** → **+ New account**
2. Pick a category (start with `sim_funded` if you're trying a prop account, `cash` for a real broker, or `bank` for your personal money hub)
3. Fill in account size, drawdown rules, contract caps, and anything else you want enforced
4. Save, then start logging trades

**Optional: seed fake data**

```sh
python3 scripts/seed_test_data.py
```

This writes 45 closed trades, 3 open trades, 5 plans, and 11 tags to the first active account in the DB. The app must have launched at least once so migrations have run and the DB file exists. The seed script is additive — it won't wipe your existing data, but it does write directly to the live DB, so only run it if you want to mix fake and real data or you're testing on a fresh DB.

---

## Common commands

| Command | What it does |
|---|---|
| `npm run tauri dev` | Full dev loop — Vite + Rust backend. **Quit and relaunch after adding a migration** (hot reload won't re-run migrations). |
| `npm run dev` | Vite only on port 1420. Rarely useful on its own — `tauri dev` already starts it. |
| `npm run build` | Vite production build into `dist/`. Consumed by `tauri build`. |
| `npm run tauri build` | Produce a distributable desktop bundle. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Fast Rust syntax/type check without a full build. Useful after touching `src-tauri/src/lib.rs`. |
| `python3 scripts/seed_test_data.py` | Seed fake trades/plans/tags against the first active account. |

There is **no test suite and no linter configured**. `npm run build` + `cargo check` are the only automated gates. Manual verification is the expected pattern — check the app in `tauri dev` after every non-trivial change.

---

## Repository layout

```
futures-journal/
├── README.md                    this file
├── CLAUDE.md                    Claude Code orientation doc — quick-ref version of this README
├── package.json                 npm package + scripts
├── vite.config.js               Vite config (root = src/, output = dist/)
│
├── src/                         FRONTEND
│   ├── main.js                  hash-based SPA router, sidebar shell, bootstrap
│   │
│   ├── lib/                     data layer + pure math
│   │   ├── db.js                query()/exec() wrappers over the singleton SQLite connection
│   │   ├── accounts.js          accounts CRUD, categories, transactions, transfers, drawdown floor, headroom, risk context loader
│   │   ├── trades.js            trades CRUD with computed P&L / R-multiple fields
│   │   ├── plans.js             plans CRUD + lifecycle
│   │   ├── tags.js              tags CRUD (four categories)
│   │   ├── instruments.js       instruments table access (seeded from 001, is_micro classifier)
│   │   ├── settings.js          KV settings access + SETTING_KEYS constant
│   │   ├── calc.js              PURE — P&L, risk, R-multiple, RR, shape validators. No DOM, no DB.
│   │   ├── risk.js              pre-trade risk engine — assessDraft(), evaluateTradeRisk(), mini/micro caps
│   │   ├── analytics.js         PURE — summarizeTrades, equityCurve, groupBy*, consistencyStatus, streaks
│   │   ├── ledger.js            PURE — realMoneyLedger(), category helpers, filterLedgerByRange, feesByPaidForAccount
│   │   ├── backup.js            autoBackup(), listBackups(), pruneBackups() — 14-day retention
│   │   ├── export.js            CSV and JSON export/restore
│   │   ├── images.js            image attach/detach via Tauri commands
│   │   └── format.js            fmtMoney, fmtDate, privacy mode masking, esc (HTML escape)
│   │
│   ├── pages/                   one module per route
│   │   ├── dashboard.js         Today panel, headline stats, equity curve, recent trades
│   │   ├── accounts.js          list / detail / form + transaction & transfer modals
│   │   ├── trades.js            list / detail / form + pre-trade risk panel + review loop
│   │   ├── plans.js             list / detail / form + "take this plan" handoff
│   │   ├── analytics.js         filters, view-mode pill, widgets
│   │   ├── calendar.js          monthly grid of closed trades
│   │   ├── ledger.js            real-money ledger page — range pills, totals, curve, fee burn, events
│   │   ├── tags.js              tags management
│   │   ├── settings.js          settings + export/backup management
│   │   └── placeholder.js       used for any route without a real page yet
│   │
│   ├── components/              shared UI
│   │   ├── modal.js             openModal / closeModal / confirmDialog
│   │   ├── charts.js            lineChart, barChart — SVG, no dependency
│   │   ├── image-gallery.js     shared image-attachment UI for trades & plans
│   │   └── tag-picker.js        tag multi-select widget
│   │
│   └── styles/
│       ├── tokens.css           design tokens (colors, spacing, fonts)
│       ├── base.css             resets and base element styles
│       └── app.css              application styles
│
├── src-tauri/                   RUST BACKEND
│   ├── Cargo.toml               deps — tauri 2, tauri-plugin-sql (sqlite), dialog, opener, serde
│   ├── build.rs                 tauri build hook
│   ├── tauri.conf.json          app identity, window config
│   ├── capabilities/            Tauri v2 capability definitions
│   ├── gen/                     generated Tauri files (do not edit)
│   ├── icons/                   app icons for each platform
│   │
│   ├── src/
│   │   └── lib.rs               migration vec + custom commands (save_image, delete_image,
│   │                            read/write_text_file, list/write/read/delete_backup — all
│   │                            sandboxed to their respective app-data subdirs)
│   │
│   └── migrations/              forward-only numbered SQL
│       ├── 001_initial.sql              initial schema + instruments seed
│       ├── 002_account_rules_notes.sql  rules_notes column on accounts
│       ├── 003_plan_tags.sql            plan_tags join table
│       ├── 004_trade_risk_override.sql  per-trade risk_override
│       ├── 005_trade_review.sql         review_completed + review_notes on trades
│       ├── 006_drawdown_mode.sql        per-account drawdown mode + lock-at-target v1
│       ├── 007_account_rule_refinements.sql  lock offset, mini/micro split, consistency limit
│       ├── 008_account_category.sql     combine/sim_funded/live_funded/cash/bank category
│       └── 009_transfers_and_tx_types.sql  transfer_out/in types, linked_tx_id, paid_for_account_id
│
├── scripts/
│   └── seed_test_data.py        fake trade/plan/tag seeder (first active account)
│
├── tasks/                       rolling project notes, not shipped
│   ├── todo.md                  phased feature planning
│   └── lessons.md               self-correction notes from past mistakes
│
└── dist/                        Vite build output (generated)
```

---

## Data model primer

The conceptual shape of the database. Every table lives in SQLite; see `src-tauri/migrations/001_initial.sql` for the exact DDL.

### Core tables

**`accounts`** is the central row. Every other trading row references it.

- Identity: `name`, `prop_firm` / `broker`
- Classification (two columns, source-of-truth is `category`):
  - `type` — legacy `funded | cash`, read by the risk engine
  - `category` — `combine | sim_funded | live_funded | cash | bank` (since migration 008)
- Starting state: `account_size`, `current_balance` (derived, recomputed on every write that affects it)
- Rules: `drawdown_mode`, `trailing_dd`, `dd_lock_offset`, `dd_lock_on_payout`, `daily_loss_limit`, `profit_target`, `max_minis`, `max_micros`, `consistency_pct`, `rules_notes`
- Lifecycle: `is_active`, `archived_at`, `created_at`

**`trades`** — closed and open trades.

- Refs: `account_id`, `instrument`, optional `plan_id`
- Shape: `direction`, `entry_time`, `entry_price`, `stop_price`, `target_price`, `contracts`, `exit_time`, `exit_price`
- Computed: `pnl_points`, `pnl_dollars`, `r_multiple` (filled on close)
- Metadata: `status` (`open` / `closed`), `fees`, `confidence`, `notes`, `risk_override`, `review_completed`, `review_notes`

**`plans`** — planned trades.

- Refs: `account_id`, `instrument`, optional `trade_id` (the trade that executed it)
- Shape: `direction`, `entry_price`, `stop_price`, `target_price` (**required**), `contracts`, `rr_planned`
- Metadata: `thesis`, `status` (`active` / `taken` / `invalidated` / `expired`)

**`transactions`** — the account ledger.

- Refs: `account_id`, optional `linked_tx_id`, optional `paid_for_account_id`
- Types: `deposit`, `withdrawal`, `payout`, `fee`, `reset`, `activation`, `transfer_out`, `transfer_in`
- Shape: `amount` (always positive; the type supplies the sign), `occurred_at`, `note`
- Transfer pairs: a single logical transfer inserts one `transfer_out` row on the source and one `transfer_in` row on the destination, linked via `linked_tx_id`. Deleting either side deletes both.
- Fee attribution: a `fee`/`reset`/`activation` logged on your bank or cash account can carry `paid_for_account_id` pointing at the funded account it pays for — the ledger uses this for per-account fee burn reporting.

**`instruments`** — seeded once by migration 001 with ES, MES, NQ, MNQ, RTY, M2K, CL, MCL, GC, MGC, SI, SIL, ZB, ZN, ZF, HG, etc.

- Shape: `symbol`, `name`, `exchange`, `tick_size`, `tick_value`, `point_value`, `currency`, `category`, `is_micro`
- Invariant: `point_value = tick_value / tick_size`
- `is_micro` (0 or 1) is the classification the risk engine reads for mini vs. micro contract caps.

### Join / polymorphic tables

- **`trade_tags`** — `trade_id × tag_id`, cascade delete
- **`plan_tags`** — `plan_id × tag_id`, cascade delete (migration 003)
- **`trade_images`** — polymorphic, carries either `trade_id` or `plan_id`, never both

### Support tables

- **`tags`** — `name`, `color`, `category` (`strategy | setup | condition | mistake`)
- **`settings`** — simple KV, accessed via `src/lib/settings.js`

### Important invariants

- `accounts.current_balance` is always derived by `recomputeBalance()` in `src/lib/accounts.js` as `account_size + Σ(signed transactions) + Σ(closed trade P&L)`. Never write to it directly.
- The two-ledger model (real money vs. simulated) is **entirely derived** from `accounts.category` plus transaction types. There's no "ledger" table — `realMoneyLedger()` in `src/lib/ledger.js` is a pure function over accounts + trades + transactions.
- Transfers always come in pairs. `createTransfer()` in `src/lib/accounts.js` inserts both rows atomically and rolls back the orphan half if either insert fails.

---

## The opinionated bits

These are deliberate design choices. If you're adding features, don't accidentally undo them.

- **Futures only.** No stocks, crypto, or options. The entire math path assumes `point_value × contracts`.
- **Stops required on every trade.** The shape validator in `src/lib/calc.js` rejects trades without a stop.
- **R-multiples first.** Win rate and avg R are the primary performance metrics. Dollar P&L is reported but not optimized for.
- **No percentage P&L anywhere.** A 2% day on a $50k funded account says nothing about the trader; dollars and R do.
- **Plans need a target.** An entry without a target isn't a plan. `plans.target_price NOT NULL`.
- **Firm rules live on the account.** Zero `if prop_firm == 'X'` branches anywhere in the codebase. Rules are modeled as generic mechanisms per-account (drawdown mode, lock offset, contract caps, consistency %, etc.) and you configure them once per account. Firms change their rules every few months; code that hardcoded those values would be wrong by next quarter.
- **Safety UI maximizes visibility.** The dashboard Today panel shows **every active account** regardless of which rule columns are set. Cards adapt to what's configured; accounts are never hidden from safety UI because one column is null.
- **Failed combines archive, not delete.** Hidden from analytics by default, but reviewable via "include archived" so you can see what went wrong.
- **Simulated P&L never touches the real ledger.** Trade P&L on a combine, sim-funded, or live-funded account is sim money until it materializes as a `payout` or as the real side of a `transfer` into a real account. Live-funded trade P&L specifically only counts when withdrawn — the firm can still yank it before then.
- **Local-first, no telemetry.** SQLite file, no cloud, no accounts, no analytics pings. Your trade log is yours.

---

## Privacy mode

A UI preference in Settings that masks dollar amounts everywhere in the app. Useful for:

- Screen-sharing a walkthrough
- Taking screenshots to share
- Sitting in a coffee shop

Implementation lives in `src/lib/format.js`. `setPrivacyMode()` runs at bootstrap via `src/main.js` **before the first render**, so no raw dollar values flash on screen when enabled. Every component that displays money uses `fmtMoney()` which respects the flag.

If you're adding new code that displays a dollar amount, always go through `fmtMoney()` — don't format numbers inline with template literals.

---

## Migrations and schema evolution

Migrations are **forward-only, numbered**. They live in `src-tauri/migrations/NNN_description.sql`.

### Adding one

1. Create `src-tauri/migrations/NNN_your_change.sql` with the SQL you want to run. Use the next unused version number.
2. Append a `Migration { version, description, sql: include_str!("../migrations/NNN_your_change.sql"), kind: MigrationKind::Up }` entry to the vec in `src-tauri/src/lib.rs::run()`.
3. **Quit and relaunch `npm run tauri dev`** — hot reload won't re-run migrations. They only apply on Tauri backend startup.

### Modifying CHECK constraints

SQLite does **not** support modifying CHECK constraints in place. If you need to widen an enum column (for example, adding a new valid value), you have to do the canonical table rebuild:

```sql
CREATE TABLE foo_new ( ... new schema ... );
INSERT INTO foo_new SELECT ... FROM foo;
DROP TABLE foo;
ALTER TABLE foo_new RENAME TO foo;
```

See `src-tauri/migrations/009_transfers_and_tx_types.sql` for the reference implementation — it widens the `transactions.type` CHECK from five values to eight. Nothing else foreign-keys into `transactions`, which made that rebuild safe. If you're rebuilding a table with inbound foreign keys, think carefully about order and referential integrity first.

### Current migration list

| # | Migration | Purpose |
|---|---|---|
| 1 | `001_initial.sql` | Initial schema + instruments seed |
| 2 | `002_account_rules_notes.sql` | `rules_notes` free-form column on accounts |
| 3 | `003_plan_tags.sql` | `plan_tags` join table |
| 4 | `004_trade_risk_override.sql` | Per-trade risk override field |
| 5 | `005_trade_review.sql` | Post-trade review columns |
| 6 | `006_drawdown_mode.sql` | Per-account drawdown mode + lock-at-target v1 |
| 7 | `007_account_rule_refinements.sql` | Lock offset, mini/micro split, consistency limit |
| 8 | `008_account_category.sql` | `combine`/`sim_funded`/`live_funded`/`cash`/`bank` categories |
| 9 | `009_transfers_and_tx_types.sql` | Transfer pairs, activation type, `linked_tx_id`, `paid_for_account_id` |

---

## Data safety and backups

Your trades are irreplaceable, so the app takes several layers of precaution:

- **Automatic daily backup on launch.** `autoBackup()` in `src/lib/backup.js` runs once per calendar day, fire-and-forget after settings load. If today's backup already exists, it's skipped (idempotent).
- **14-day retention.** The 14 most recent auto-backups are kept. Older auto-backups are pruned on the next launch. Manual backups created via Settings are **never** auto-pruned.
- **Sandboxed file access.** All backup file commands on the Rust side (`list_backups`, `write_backup`, `read_backup`, `delete_backup`) canonicalize paths and refuse anything outside `<app_data>/backups/`. Same pattern as `save_image`/`delete_image` for the `images/` directory.
- **Transactional JSON restore.** Restoring from a backup wraps the full operation in a transaction; if any insert fails, the entire restore rolls back and the old DB state is preserved.
- **Settings page tools.** Manual backup button, restore-from-file button, list of existing backups with per-item restore/delete, and a "last auto-backup" indicator.

If you ever need to recover manually: the DB file is at `<app_data>/futures-journal.db`, and backups are JSON files in `<app_data>/backups/`. On macOS that's `~/Library/Application Support/com.adamwickwire.futuresjournal/`.

---

## Roadmap

Active development is tracked in `tasks/todo.md`. The current working phase is **Phase 8 — Real money ledger and account categories**, with sub-phases 8.1 through 8.5 landed (account categories, bank + linked transfers, ledger computation + page, analytics segmentation, dashboard real-money stat).

Future phases are not yet planned in detail. Likely directions:

- Recurring subscription auto-logging (so you don't manually enter the same combine fee every month)
- Per-instrument risk presets
- A dedicated review calendar
- Charts on the ledger page to visualize fee burn trends

No commitments on timing. This is a personal project.

---

## Contributing

This is a personal project and there is no external contribution process. If you want to fork it for your own use, the only things I ask are:

1. Read `CLAUDE.md` and [The opinionated bits](#the-opinionated-bits) before making structural changes. The constraints are deliberate.
2. Run `npm run build` and `cargo check --manifest-path src-tauri/Cargo.toml` before committing. There's no CI; those are the only gates.
3. Commit messages follow a loose `Phase N: short description` convention. Multi-line messages with a detail paragraph per feature are encouraged for big changes.
4. Don't hardcode prop firm rules anywhere. If you find yourself writing `if (account.prop_firm === 'X')`, stop and add a generic mechanism on the account row instead.

---

## License

**No license is currently specified.** All rights reserved by the author. If you want to reuse any part of this code for something other than a personal fork, ask first.

---

## Acknowledgments

Built on the shoulders of:

- [Tauri 2](https://tauri.app/) — the desktop shell, SQL plugin, dialog plugin
- [Vite](https://vite.dev/) — frontend dev/build
- [SQLite](https://www.sqlite.org/) — the only database I'd trust on my own disk with my own data

No embedded assets, no vendored libraries, no runtime dependencies beyond what's listed above.
