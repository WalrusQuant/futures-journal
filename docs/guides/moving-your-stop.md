# Moving your stop

When to update the **Stop price** field on a trade after you've moved your stop in the market — and when to
leave it alone.

Moving your stop to break-even, to a trailing runner stop, or to lock in profit is part of normal trade
management. But the **Stop price** field on a trade row is special: it represents your **initial risk** at
entry, which is the denominator of every R-multiple this app computes. If you overwrite it after the fact,
you lose your honest R baseline and your stats silently drift.

This guide explains the rule and where to record stop adjustments instead.

---

## The rule of thumb

**`stop_price` on a trade means the stop at entry, not the stop right now.**

The R-multiple formula is `(exit − entry) / (entry − stop)` for longs. The denominator — initial risk — is
what makes R work as a comparable unit across every trade in your history. If you move your stop to
break-even after a trade moves 1R in your favor and then update the stop field to match, you've just
retroactively rewritten your initial risk to zero, which either blows up the R calculation (divide by zero)
or makes every subsequent R number meaningless.

So:

- **Don't update the Stop price field** when you move your stop to break-even, to a runner stop above your
  entry, or to lock in partial profit. The original stop is your initial risk. Leave it.
- **Do update the Stop price field** if you mis-typed the original entry stop when you first logged the
  trade and you're correcting the record. That's a data fix, not a trade management event.

## Where to record stop adjustments

The right place to record in-trade stop management is the **Notes** field. A single line is usually enough:

> Moved stop to BE at 5805 after TP1 hit.

Or:

> Trailed stop under each new HL. Final stop pulled to 5812 before the reversal.

You're writing for your future self reviewing the trade next week. The detail level is your call, but even a
terse one-liner is better than nothing because it gives the review step something to read.

## How this connects to the review loop

The honest place stop management shows up in your journal is the **Exit discipline** score during review.
When you close the trade and review it, the 1–5 Exit discipline score is where "I managed the stop
correctly" or "I should have let it run" gets recorded. The score isn't about the stop field's value — it's
about whether your stop decisions were good ones given what you saw.

The flow:

1. Enter the trade with your initial stop
2. Move the stop in the market as the trade evolves (don't touch the form)
3. Trade closes — fill in Exit time and Exit price
4. In the review, write "Moved stop to BE at 5805" in Notes, give yourself an honest Exit discipline score
5. R-multiple stays anchored to your original initial risk, which is what makes the number comparable to
   your other trades

## Edge case: you actually want to widen the stop mid-trade

If you're moving your stop *wider* to give a trade more room — this is a yellow flag about your process, but
it happens — the same rule applies: don't update the field. Add a note like "Widened stop to 5790 after the
first test held" and take the R hit if it doesn't work out. Retroactively rewriting the initial risk to
match your widened stop would be lying to yourself, and the whole point of the journal is that it doesn't
let you lie to yourself.

If you find this happening often, it's a review-worthy pattern. Tag those trades with something like
`stop-widened` and look at them together on the analytics page after a few weeks.

---

## What this actually records

Nothing, if you follow the rule — moving your stop in the market is a mental/execution event, not a data
event. The `trades` row on disk stays unchanged while the trade is open except for the eventual exit
fields. When you write stop management into the Notes field during or after the trade, you're updating the
`notes` column and nothing else. R-multiple, P&L, daily loss tracking, and the drawdown floor calc all
continue reading the original `stop_price` — which is exactly the invariant that makes R-multiple a stable
stat across your whole history.

---

## Related reading

- [Logging a normal trade](logging-a-normal-trade.md) — the base loop
- [Reviewing a closed trade](reviewing-a-closed-trade.md) — where Exit discipline gets scored
- [R-multiples](../concepts/r-multiples.md) — why initial risk is sacred
- [Plans and trades](../concepts/plans-and-trades.md) — planning the stop before you need to manage it
