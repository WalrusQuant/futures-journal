# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run tauri dev` — run the full desktop app (Vite + Rust backend). This is the normal dev loop.
- `npm run dev` — Vite only on port 1420. Rarely useful in isolation; Tauri's `beforeDevCommand` already launches it.
- `npm run build` — Vite production build into `dist/` (consumed by `tauri build`).
- `npm run tauri build` — produce a distributable desktop bundle.
- `python3 scripts/seed_test_data.py` — seed the live SQLite DB with fake trades/plans against the first active account. Writes directly to `~/Library/Application Support/com.adamwickwire.futuresjournal/futures-journal.db`; the app must have been launched at least once so migrations have run.

There is no test suite and no linter configured.

## Architecture

**Stack:** Tauri 2 + vanilla JS (no framework, no bundled UI lib) + SQLite via `@tauri-apps/plugin-sql`. Vite serves `src/` with `root: "src"` and builds to `dist/`.

**Hash-based SPA router (`src/main.js`):** The app is a single `#app` mount with a sidebar shell and a `#page` slot. Routes are a flat ordered table — **exact paths must precede their `:param` siblings** because the matcher walks the list and stops at the first hit. Pages export `render(params)` that returns either an HTML string or `{ html, mount(pageEl) }` for post-insert wiring. Navigation happens via `hashchange`; `refreshPage()` re-renders only the page slot. Pages that attach window-level listeners (drag-drop, etc.) must call `registerPageCleanup(fn)` so they're torn down on navigation.

**Data layer (`src/lib/`):** All SQL goes through `db.js` (`query`/`exec` wrappers over a singleton `Database.load("sqlite:futures-journal.db")`). Each domain has its own module — `trades.js`, `plans.js`, `accounts.js`, `tags.js`, `instruments.js`, `settings.js`, `analytics.js`, `images.js`, `export.js`. Pages should call domain modules, not `db.js` directly.

**Pure math lives in `src/lib/calc.js`:** P&L, risk, R-multiple, planned RR, and shape validators for trades/plans. No DOM, no DB — import and unit-reason freely. The app is opinionated: **futures only, stops required, R-multiples are the primary metric, percentage P&L is deliberately absent** (meaningless for futures). Plans require both stop AND target (an entry without a target isn't a plan).

**Rust backend (`src-tauri/src/lib.rs`):** Thin. Registers the SQL plugin with an inline migrations vec (edit this when adding a migration — see below) and exposes four custom commands: `save_image`, `delete_image` (sandboxed to the app's `images/` dir via canonicalized path check), `write_text_file`, `read_text_file`. Everything else is the stock `tauri-plugin-sql` / `tauri-plugin-dialog` / `tauri-plugin-opener` surface.

**Migrations (`src-tauri/migrations/NNN_*.sql`):** Forward-only, numbered. Adding one requires **both** dropping the SQL file in the migrations dir **and** appending a `Migration { version, description, sql: include_str!(...), kind: MigrationKind::Up }` entry to the vec in `lib.rs::run()`. The initial schema seeds the `instruments` table with common futures contracts (ES/MES/NQ/MNQ/CL/GC/ZB/etc.) — `point_value = tick_value / tick_size` is the invariant.

**Schema shape to keep in mind:** `trades` and `plans` both reference `accounts` and `instruments`; `plans.trade_id` links a plan to the trade that executed it. `trade_tags` and `plan_tags` are join tables (plan_tags added in migration 003). `trade_images` is polymorphic — rows carry either `trade_id` or `plan_id`. `transactions` tracks deposits/withdrawals/payouts/fees/resets per account. `settings` is a simple KV table accessed via `lib/settings.js`.

**Privacy mode:** A UI preference persisted in `settings` and applied at bootstrap via `setPrivacyMode()` in `lib/format.js` before the first render — money values are masked when on. Respect this when adding any code that displays dollar amounts.
