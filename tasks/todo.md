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
