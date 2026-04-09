# Logging a normal trade

The happy path from clicking **+ New trade** to a closed, reviewed row — no scale-outs, no overrides, no
special cases.

This is the loop you'll run 95% of the time. Once you've done it three or four times you won't need this
guide. Read it once, then come back only for the sections on what each field affects and what lands in the
database.

If you haven't created any accounts yet, start with [Quickstart](../getting-started/quickstart.md).

---

## 1. Open the trade form

From anywhere in the app, click **Trades** in the sidebar and then **+ New trade**. You can also click
**+ New trade** from the dashboard. The form opens with today's time pre-filled and your default account
already selected.

If you're taking a plan you already wrote, don't start here — go to the plan and click **Take trade**
instead. That pre-fills the form from the plan and links the two rows together. See
[Taking a plan](taking-a-plan.md).

## 2. Pick the account and instrument

- **Account** — only active, non-bank accounts appear in the dropdown. Bank accounts are ledger-only and
  never show up in trade pickers. Archived accounts are hidden too.
- **Instrument** — futures symbols from the `instruments` table. Picking one shows the tick size, tick
  value, and point value just below the field so you can sanity-check your setup.

## 3. Fill in the trade

All the required fields have a red `*` next to them:

- **Direction** — Long or Short
- **Entry time** — defaults to now
- **Contracts** — integer, at least 1
- **Entry price** — your actual fill
- **Stop price** — where you're wrong. Required. The app refuses to log a trade without a stop because
  R-multiple and risk tracking don't mean anything without one.

Optional but strongly recommended:

- **Target price** — where you'd take profit. If you have one, enter it. The form will compute your
  **Planned R:R** as you type. A trade with a target and a stop is the difference between a trade and a
  plan you're executing live.
- **Fees** — commissions and exchange fees for this trade. Defaults to `0`. This gets subtracted from your
  P&L when the trade closes.

The app's shape validator will reject obvious mistakes: stop above entry on a long, target below entry on a
short, zero contracts, negative fees. You'll see the error inline on the offending field.

## 4. Watch the live preview

As you type, the preview block updates with four stats:

- **Risk** — dollar risk if your stop hits, computed from `(entry − stop) × point_value × contracts`
- **Planned R:R** — shown only if you've entered a target
- **P&L** — shown only if you've already entered an exit
- **R-multiple** — shown only if the trade has both a stop and an exit

The math is pure — no database calls — so it updates instantly on every keystroke. If the numbers surprise
you, re-check your entry, stop, and contracts before saving.

## 5. Watch the Risk check panel

Below the preview, the **Risk check** panel shows how this trade interacts with the account's configured
rules:

- The daily loss budget bar (if you have a daily loss limit set on this account)
- How much dollar risk you have across all open trades on this account
- This proposed trade's risk
- Any **blockers** (red) or **warnings** (amber)

Blockers mean the trade would break one of your firm's rules — daily loss limit, max minis or micros,
drawdown floor breach. The form still lets you try to save, but when you do it will pop the **Risk check
failed** modal and make you explicitly override. See [Overriding a risk block](overriding-a-risk-block.md)
for the full flow.

Warnings are softer — risking more than 2% of account size, risking more than half your daily loss budget on
one trade. They don't block anything. They're there to notice.

## 6. Fill in the soft fields

Below the risk panel are the optional metadata fields:

- **Tags** — pick from your existing tag list or create new ones inline. See [Using tags](using-tags.md).
- **Confidence (1–5)** — your honest read on how much you believed this trade before pulling the trigger.
  Useful later for stats like "what's my win rate on 5s versus 2s?"
- **Notes** — freeform. Setup name, levels, what you saw, what you'd do differently. The more honest the
  better.

## 7. Attach screenshots

Scroll down to the image section and drop chart screenshots directly onto the page. Files are copied into
the app's managed images directory — see [Attaching screenshots](attaching-screenshots.md). Drop the entry
chart at minimum. If you review the trade later, you'll thank yourself.

## 8. Save

Click **Log trade** at the bottom. If the risk panel was clean, the trade is saved and you're bounced to the
trade detail page. If there were blockers, the override modal appears first — click through only if you
actually mean it.

If you left the exit fields blank, the trade is saved with status `open`. When the real exit happens, come
back, click **Edit**, fill in **Exit time** and **Exit price**, and save. The trade flips to `closed`, P&L
and R-multiple get computed, and the trade enters the **needs review** bucket.

## 9. Review it

Closed trades surface a review banner on the dashboard. Click into the trade and fill in:

- **Plan followed** — yes / no / N/A
- **Exit discipline** — 1 (panic) through 5 (textbook)
- **Emotional state** — how you actually felt
- **Lessons** — one honest sentence

Click **Mark reviewed**. The banner clears. The trade is fully logged. See
[Reviewing a closed trade](reviewing-a-closed-trade.md) for why the review step matters more than the logging
step.

---

## What this actually records

Clicking Log trade on a new trade writes one row to the `trades` table with the account, instrument,
direction, entry/exit time and prices, stop, target, contracts, fees, confidence, notes, and — if the form
had to prompt you — a `risk_override` string. Tags you picked are written to the `trade_tags` join table.
Any screenshots you dropped are inserted into `trade_images` pointing at this trade's id. If the trade was
linked to a plan (via the **Take trade** button on a plan page), the plan's `status` flips to `taken` and
its `trade_id` is set to the new trade's id — that's the plan → trade link that makes the review loop work.
Once you fill in exit prices, `pnl_dollars`, `pnl_points`, and `r_multiple` are computed on save via the
pure functions in `calc.js` and persisted on the row, and `recomputeBalance()` runs to update the account's
`current_balance`.

---

## Related reading

- [Quickstart](../getting-started/quickstart.md) — the end-to-end five-minute tour this guide is the detail version of
- [Logging a scale-out trade](logging-a-scale-out-trade.md) — when you take partial profits
- [Logging a scale-in trade](logging-a-scale-in-trade.md) — when you add size after entry
- [Overriding a risk block](overriding-a-risk-block.md) — when the Risk check panel is red
- [Reviewing a closed trade](reviewing-a-closed-trade.md) — the other half of the loop
- [The risk engine](../concepts/the-risk-engine.md) — why the Risk check panel says what it says
