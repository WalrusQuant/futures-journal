# Logging a scale-in trade

How to record a trade where you added size after the initial entry — and the honest caveat about why
R-multiple becomes an approximation when you do.

Scale-ins are trickier than scale-outs because adding contracts at a different price changes two things: your
**effective entry price** (straightforward — weighted average) and your **effective stop distance**
(messier — because the gap from the stop to the new average is different from the gap at either real fill).
R-multiple is the ratio of those two numbers, so when the denominator gets fuzzy, so does the R. This guide
walks through the formula and the two ways to handle it honestly.

If you haven't read [Logging a scale-out trade](logging-a-scale-out-trade.md) yet, start there — scale-outs
are the simpler case and the weighted-average formula is the same.

---

## The weighted-average entry formula

Same shape as the scale-out formula, applied to entries instead of exits:

```
avg_entry = (size_1 * price_1 + size_2 * price_2 + ... + size_n * price_n) / total_size
```

Where `size_i` is the number of contracts added at `price_i` and `total_size` is the full final position
size. That's your blended entry price.

## Why R-multiple gets fuzzy

R-multiple in Futures Journal is defined as `(exit - entry) / (entry - stop)` for longs — points of profit
divided by points of initial risk. The problem with a scale-in is that the two real fills had **two
different initial risks**:

- Contract 1 risked the distance from `entry_1` to the stop
- Contract 2 risked the distance from `entry_2` to the stop

If `entry_2` is closer to the stop than `entry_1` (you added to a winner as it moved in your favor), contract
2's per-contract risk is smaller. If `entry_2` is farther from the stop than `entry_1` (you added into a
loser — which you probably shouldn't be doing, but people do), contract 2's risk is bigger.

The weighted-average entry collapses both fills into one number. That new number has one risk distance to
the stop, and it's neither of the real ones. The sum of dollar risks still works out if you multiply by the
full size (because weighted averages preserve totals), but the *shape* of the trade's R-multiple is now an
approximation of what actually happened.

There are two honest ways to handle this in the app. Pick one and be consistent.

## Option A: Log the original entry, full final size

The simplest and cleanest for stats.

- **Entry price**: the price of your first fill (`entry_1`)
- **Contracts**: the full final size (all pieces summed)
- **Stop**: unchanged
- **Notes**: "Scaled in: initial 2 @ 5800, added 2 @ 5805"

**What this is honest about**: your R-multiple and P&L stats stay internally consistent. R is computed against
the original initial risk, which is a stable anchor point across all your trades.

**What this lies about**: your actual dollar exposure. The form will show `(5800 − 5795) × point_value × 4` =
`$100` of risk, but your actual worst-case if the stop hit *after* the add was `(5800 − 5795) × pv × 2 +
(5805 − 5795) × pv × 2` = `$150`. The analytics page will understate your capital at risk on this trade.

Best when: you're already profitable on stats and want consistent R-multiples across the trade history, and
you're disciplined enough to look at your Notes field when reconciling against the firm's report.

## Option B: Log the weighted-average entry, full final size

The most faithful to final exposure.

- **Entry price**: the weighted-average entry (`(n1*p1 + n2*p2) / total`)
- **Contracts**: the full final size
- **Stop**: unchanged
- **Notes**: "Weighted avg: 2 @ 5800, 2 @ 5805; blended 5802.50"

**What this is honest about**: your total dollar P&L matches the firm's report exactly. The entry-to-stop
distance in the form now reflects your actual worst-case capital at risk from the moment the full size was on.

**What this approximates**: R-multiple. Because the blended entry is farther from the stop than the original
entry was, the R denominator is bigger, and the resulting R number understates how many "original R" units
you actually made. Across many trades this averages out but on any single trade it's not the "true" R.

Best when: you care more about matching the firm's P&L reporting than about internally consistent R stats,
or when your stop was relatively wide and the add-in was small enough that the R approximation is a rounding
error.

## Worked example

You go long 2 MES at `5800.00` with a stop at `5795.00`. Thirty seconds later, price is at `5805.00` and the
setup still looks strong, so you add 2 more contracts. Stop stays at `5795.00` on the full 4-lot. Price
continues to `5815.00` and you cover the whole position there.

- **Initial risk on contract 1**: `(5800 − 5795) × $5 × 1` = `$25`
- **Initial risk on contract 2**: also `$25` (same entry)
- **Initial risk on contract 3**: `(5805 − 5795) × $5 × 1` = `$50`
- **Initial risk on contract 4**: `$50`
- **Total actual worst-case risk**: `$150`
- **P&L**: contracts 1–2 made `15 points × $5 × 2` = `$150`; contracts 3–4 made `10 points × $5 × 2` = `$100`;
  total `$250` gross

**Option A** logs this as: entry `5800.00`, 4 contracts, stop `5795.00`, exit `5815.00`. Form shows risk
`$100`, P&L `+$250`, R-multiple `+2.5R`. The P&L is wrong by `$0` (because it's still prices × points ×
contracts) — wait, check that. `(5815 − 5800) × $5 × 4` = `$300`. That's different from the `$250` actual!
Option A overstates the P&L because it pretends all 4 contracts were in from the start.

**Option A is therefore NOT safe for scale-ins** the same way it is for scale-outs. Use Option B.

**Option B** logs this as: entry `5802.50` (weighted avg of `(2×5800 + 2×5805)/4`), 4 contracts, stop
`5795.00`, exit `5815.00`. Form shows risk `(5802.50 − 5795) × $5 × 4` = `$150`, P&L
`(5815 − 5802.50) × $5 × 4` = `$250`, R-multiple `12.50 / 7.50` = **`+1.67R`**. P&L matches reality. R is a
blended approximation but it's anchored in real capital at risk.

**For scale-ins, Option B is the only version that produces honest P&L.** The earlier framing of "pick
either" was optimistic — Option A works for scale-outs because exit prices don't affect the entry baseline,
but for scale-ins it double-counts the gains on the contracts that weren't in yet. Use Option B on scale-ins,
always.

## Why scale-ins are rare in this app's target user

The Trader A philosophy this app is built for — combine-passing and first-payout-earning — leans toward
fixed-size entries and fixed stops. Scaling in is a Trader B technique: it rewards precision reads and
punishes marginal ones, and it's one of the fastest ways to turn a winning plan into a break-even trade. If
you find yourself scaling in frequently, read the [Plans and trades](../concepts/plans-and-trades.md)
concept doc and ask whether your plans have the right size baked in from the start.

---

## What this actually records

A scale-in logged via Option B creates exactly one row in the `trades` table with `entry_price` set to the
weighted average, `contracts` set to the full final size, and `stop_price` unchanged from the original plan.
P&L and R-multiple are computed from those values by the same pure functions in `calc.js` as any normal
trade — there's no special scale-in path in the code. The authentic history of the two fills lives in the
`notes` column where you wrote it down. Consider adding a tag like `scale-in` so you can filter to these
trades later on the analytics page and see whether the practice is paying for itself.

---

## What about scale-outs?

Scale-outs are the simpler case because they don't affect the entry. See
[Logging a scale-out trade](logging-a-scale-out-trade.md) for that workflow.

## Related reading

- [Logging a scale-out trade](logging-a-scale-out-trade.md) — the simpler cousin
- [Logging a normal trade](logging-a-normal-trade.md) — the base loop
- [R-multiples](../concepts/r-multiples.md) — why R is the primary metric and why this matters
- [Plans and trades](../concepts/plans-and-trades.md) — sizing in the plan vs on the fly
- [Using tags](using-tags.md) — tag your scale-ins so you can review them separately
