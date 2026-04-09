# Logging a scale-out trade

Log it as one trade with a weighted-average exit price — the same way every prop firm's own journal does it,
and the same way your broker statement will reconcile.

Futures Journal has no native scale-out feature, and that's a deliberate choice. A trade is one row with one
entry, one stop, one exit, and one P&L number. When you take partials at different prices, you fold them
into a single exit price using a weighted average. The math is five seconds of arithmetic and the result is
honest — it matches your firm's reported P&L to the cent and it keeps the analytics model simple enough to
actually use.

This guide walks through the formula, a real worked example, and the tradeoff you should understand before
you accept it.

---

## The formula

Weighted-average exit for a position that closed in pieces:

```
avg_exit = (size_1 * price_1 + size_2 * price_2 + ... + size_n * price_n) / total_size
```

Where `size_i` is the number of contracts closed at `price_i` and `total_size` is the original position size
(which must equal the sum of all pieces — if you're still holding a runner, the trade isn't closed yet).

That's it. No gotchas. No direction-dependence — the formula is the same for longs and shorts because prices
are prices.

## Worked example

Here's a real shape you'll run into: short 4 MES, scale out of 3 at your first target, let 1 runner go to a
second target.

- **Instrument**: MES (Micro E-mini S&P 500, `$5` per point)
- **Direction**: Short
- **Entry**: 4 contracts at `6813.75`
- **Stop**: `6817.00` (initial risk = `3.25` points = `$65` total)
- **Scale 1**: 3 contracts covered at `6805.00` (TP1)
- **Scale 2**: 1 contract covered at `6805.25` (runner, ground out near the same level)
- **Fees**: `$7` total round-trip

**Step 1 — compute the weighted average exit:**

```
avg_exit = (3 * 6805.00 + 1 * 6805.25) / 4
        = (20415.00 + 6805.25) / 4
        = 27220.25 / 4
        = 6805.0625
```

Round to the price the app will accept — for MES, that's a `0.25` tick, so use `6805.06` as a representative
number. (If your firm shows `6805.0625`, the app accepts that too — MES tick is `0.25` but the form takes
arbitrary precision because some firms report broken ticks after fees and rebates.)

**Step 2 — verify the P&L in your head:**

Short entry at `6813.75`, exit at `6805.0625`, difference is `8.6875` points. Times 4 contracts times `$5`
per point = `$173.75` gross. Minus `$7` fees = **`$166.75` net**. That should match what Tradeify (or
whoever) shows for the same trade. If it's off by a tick or two, you probably rounded the average — redo the
math with the raw decimal average and the numbers will reconcile.

**Step 3 — log the trade:**

1. Click **+ New trade** (or open the existing open trade and click **Edit** if you already logged the
   entry before the scale-outs)
2. Fill in the entry side normally: 4 contracts, entry `6813.75`, stop `6817.00`
3. In the Exit block, fill in **Exit time** with the time of your *final* fill (the runner's close time, not
   TP1's) and **Exit price** with the weighted-average number: `6805.0625`
4. Add your fees in the **Fees** field: `7`
5. Click **Log trade** (or **Save changes** if editing)

The preview will show P&L = `+$166.75` and R-multiple = `8.6875 / 3.25` = **`+2.67R`**. That's the single
honest summary of the whole scale-out in one row.

## The tradeoff

Folding a scale-out into one row loses one thing: you can no longer ask the analytics page "is my runner
+EV?" as an independent question. The runner's contribution is baked into the average and you'd have to
back it out by hand from notes.

That is a real limitation. But it's a **Trader B optimization question** — the kind of thing that matters
when you're already profitable and trying to squeeze another half R out of your execution. Futures Journal
v1 is explicitly designed for **Trader A**: someone working through combines, earning their first payouts,
and trying to build the discipline of planning, logging, and reviewing trades honestly. For that user, the
simplicity of one-row-per-trade is more valuable than the fidelity of being able to track runners
separately.

If you want to remember what the scale-out looked like, the honest place is the **Notes** field: "TP1 3 @
6805.00, runner 1 @ 6805.25" is a perfectly good record. You'll read it when you review the trade and you
won't wish it was a separate row.

## Scale-out calculator

If you don't feel like computing weighted averages in your head each time, here's the formula one more time
— copy it to a sticky note:

```
avg_exit = (n1*p1 + n2*p2 + n3*p3 + ...) / (n1 + n2 + n3 + ...)
```

Examples:

- **2 and 2 at two targets**: `(2*p1 + 2*p2) / 4` — which simplifies to `(p1 + p2) / 2`, the plain midpoint
- **3 and 1 runner**: `(3*p1 + 1*p2) / 4`
- **4 and 1 runner**: `(4*p1 + 1*p2) / 5`
- **1 at scratch, 2 at target, 1 runner**: `(1*p0 + 2*p1 + 1*p2) / 4`

For even splits, the average is just the plain mean of the exit prices. For uneven splits, you need the
weights.

## What about scale-ins?

Scale-ins — adding contracts *after* you're already in the trade — are trickier because they change both the
effective entry price *and* the effective stop distance, which makes R-multiple an approximation regardless
of how you log it. See [Logging a scale-in trade](logging-a-scale-in-trade.md) for the full discussion and
the two honest ways to handle it.

---

## What this actually records

A scale-out logged this way creates exactly one row in the `trades` table — same as a normal trade. The
`exit_price` column holds the weighted average. `pnl_dollars` and `pnl_points` are computed from that single
average using `tradePnL()` in `calc.js`, and `r_multiple` uses `(avg_exit − entry) / (entry − stop)` via
`rMultiple()`. Because the math is all point-based and the average is mathematically equivalent to summing
the per-piece P&Ls, the total matches what your firm reports to the cent (modulo any rounding you did on the
average). The risk engine, drawdown floor calc, consistency rule, and everything else downstream sees the
trade as one closed position with the blended exit — exactly as intended.

---

## Related reading

- [Logging a normal trade](logging-a-normal-trade.md) — the base loop this builds on
- [Logging a scale-in trade](logging-a-scale-in-trade.md) — the trickier cousin
- [R-multiples](../concepts/r-multiples.md) — why R-multiple is point-based and what that means for scale-outs
- [The two ledgers](../concepts/the-two-ledgers.md) — why the app prioritizes Trader A simplicity over Trader B fidelity
- [Reviewing a closed trade](reviewing-a-closed-trade.md) — where your Notes about the scale-out get read later
