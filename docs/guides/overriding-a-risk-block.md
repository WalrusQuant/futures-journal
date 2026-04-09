# Overriding a risk block

What to do when the **Risk check** panel on the trade form is red and the app refuses to save quietly.

The risk engine is your seatbelt, not your jailer. You can override any blocker it throws at you, but the
override — and the reason you gave — gets recorded on the trade so you can review your discipline pattern
over time. This guide walks through exactly what triggers the override flow, what the modal looks like, and
what lands in the database when you click through.

If you haven't read [The risk engine](../concepts/the-risk-engine.md) yet, that's the concept doc this
guide assumes.

---

## What triggers the override flow

The risk engine distinguishes **blockers** (red) from **warnings** (amber). Only blockers trigger the
override flow. Warnings show up in the Risk check panel but don't interrupt save.

The current blockers, from `evaluateTradeRisk()` in `src/lib/risk.js`:

- **Daily loss limit** — if today's realized P&L + all open-trade risk + this proposed trade's risk would
  breach the account's daily loss limit, the trade is blocked
- **Max minis exceeded** — if `open_minis + this_trade_contracts` exceeds the account's mini cap (and the
  proposed instrument is a mini)
- **Max micros exceeded** — same check against the micro cap for a micro instrument
- **Trailing drawdown floor** — if the worst-case balance (current − this trade's risk) would drop below
  the account's computed drawdown floor

Each of those is only checked if the corresponding column on the account is configured — empty fields skip
the check entirely. Warnings ("risking more than 2% of account size", "this trade alone risks more than half
your daily loss limit") are informational and never block.

## The flow

1. You fill out the trade form with values that would trigger one or more blockers. The Risk check panel
   below the form shows them in red while you type.
2. You click **Log trade** (or **Save changes** on an open edit).
3. The form re-runs the risk assessment one more time at submit to catch any stale state.
4. If blockers are still present, the **Risk check failed** modal opens.
5. The modal lists every blocker with its message and detail.
6. Below the list, there's an unchecked checkbox: **"I understand the risk and want to proceed anyway."**
7. Below that, a textarea: **"Reason (optional, but recommended)"** with placeholder text
   `"Why are you overriding? e.g. 'High-conviction setup, smaller size than usual.'"`.
8. At the bottom, two buttons: **Cancel** and **Override and log trade**. The **Override and log trade**
   button is disabled until the checkbox is ticked, and it's styled red (danger).
9. You either click **Cancel** — which dismisses the modal and leaves you on the form — or check the
   acknowledgment box, optionally type a reason, and click **Override and log trade**.

Closing the modal any other way (Escape key, clicking outside) counts as cancel.

## What gets recorded

If you override, the trade is saved with a `risk_override` column populated on its row. The value is the
reason string you typed into the textarea, trimmed. If you left the textarea empty, it stores the literal
string `"(no reason given)"` — the app never stores null for an override because that would be
indistinguishable from "no override at all".

Everything else about the trade saves normally. P&L, R-multiple, tags, images, and the plan link all work
the same way.

## Where overrides show up later

On the trade detail page, any trade with a non-null `risk_override` gets a flagged section near the top
labeled **⚠ Risk override recorded** with the reason you gave. It's hard to miss — that's intentional. When
you review the trade (or when you're scrolling back through history later), the override is the first thing
you see.

The analytics page doesn't currently slice the stats by override status, but the column is on every trade
row, so you can always go hunt for your overrides in the trade list and review them by hand. A good
practice is to read your overrides once a week: were the reasons any good? Did the override trades make
money? Is there a pattern — time of day, instrument, setup type — to the override habit?

## The discipline angle

The point of the override flow isn't that you should never override. Sometimes you really do have a good
reason — a high-conviction setup, a day where you're down small and still want to trade a small clean
opportunity, a rule that your firm relaxed that you haven't updated in the form yet. The point is:

- **You override consciously.** The modal makes you stop, read the blockers, tick the box, and write a
  reason. That one extra beat is the whole value.
- **You can look back.** The reason is on the row forever. Next month you can read your overrides and ask
  "was that the right call?" and "am I overriding for the same reason every time?"
- **The pattern is the data.** If you find yourself overriding twice a week with reasons like "I just
  wanted to trade", that's useful information about your process that you wouldn't see if the app silently
  waved every trade through.

Treat the modal as a second chance, not a formality. If you can't think of a real reason to write in the
textarea, that's the answer — click Cancel and wait for a trade that doesn't breach your rules.

---

## What this actually records

Clicking **Override and log trade** saves the trade row to the `trades` table the same way any normal save
does, with one extra column populated: `risk_override` holds the trimmed text from the reason textarea, or
the literal string `(no reason given)` if you left it blank. Nothing else on the trade row is affected by
the override — P&L, R-multiple, balance recomputation, and tag/image attachments all run identically. The
blockers themselves are not stored as structured data; only the fact that you overrode and the reason you
gave are preserved. Warnings are never stored regardless of whether the trade breached them.

---

## Related reading

- [The risk engine](../concepts/the-risk-engine.md) — how blockers and warnings get computed in the first place
- [Drawdown modes](../concepts/drawdown-modes.md) — the drawdown floor blocker explained in detail
- [Configuring prop firm rules](configuring-prop-firm-rules.md) — what each Rules-tab field actually enforces
- [Logging a normal trade](logging-a-normal-trade.md) — the happy path this guide is the exception to
- [Reviewing a closed trade](reviewing-a-closed-trade.md) — where you'll read your overrides later
