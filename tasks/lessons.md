# Lessons

Corrections from the user, captured so the same mistake doesn't repeat.

## 2026-04-08 — Safety UIs should show all accounts, not just configured ones

**Mistake:** When building the dashboard "Today" panel in Phase 7.2, I filtered out any account that didn't have `daily_loss_limit` set. Reasoning: "unconfigured rule = no nag."

**Correction:** User wants every active account visible on risk/safety panels regardless of which columns are set. Even an account without a daily loss limit still cares about max drawdown, open exposure, and today's P&L. The card content adapts to whichever rules are configured; the account itself is never hidden.

**Rule for next time:** Default to inclusion on any safety/risk UI. Opt-out (e.g. `daily_loss_limit == null` skipping a *specific bar*) is fine at the per-rule level, but not at the per-account level. This applies to the dashboard, account detail, analytics drilldowns, and anywhere else risk context is shown.

## 2026-04-08 — New migrations require a full Tauri dev restart

**Mistake:** After adding migration 005 in Phase 7.3, I told the user to "verify in the app" without warning them to cold-restart the Tauri dev loop. They hit "no such column: review_completed" because a hot-reload (Cmd+R in the webview) only reloads the JS/webview, not the Rust process — and tauri-plugin-sql applies migrations at plugin init (Rust startup), not on webview reload.

**Rule for next time:** Whenever a phase includes a new migration file, explicitly tell the user to **fully quit the app and restart `npm run tauri dev`** before verifying. Don't say "reload" — that's ambiguous and user may interpret it as Cmd+R. Say "fully quit and relaunch the dev loop so the Rust side picks up the new migration."
