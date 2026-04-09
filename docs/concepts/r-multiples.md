# R-multiples

Futures Journal uses R-multiples — P&L divided by initial risk — as its primary performance metric, and percentage P&L is deliberately absent because it's meaningless for futures.

If you've come from a stock-trading journal where everything is reported in dollars and percents,
the R-first framing takes a minute to settle into. Stick with it. For futures the R-multiple is
the number that tells you the truth, and dollars and percentages are flattering at best and
misleading at worst.

---

## What an R-multiple is

An **R-multiple** is how many "units of initial risk" a trade made or lost.

```
R = trade P&L (in points) / initial risk (in points)
```

If you risked 5 points on a trade and made 10 points, that's **+2R**. Risked 5, lost 5, that's
**−1R** — a textbook full stop-out. Risked 5, made 2.5, that's **+0.5R** — the classic "scratched
out at the first sign of trouble." Risked 5, made 15, that's **+3R** — a runner that behaved.

The app computes R from points, not dollars, so fees and contract count don't enter the formula.
This matters: a +2R trade is a +2R trade whether you were in one MES or forty, whether you paid
$2 in commissions or $200. R is a pure measurement of *how well the setup worked*.

---

## Why R beats dollars

Dollars have an obvious problem: they're not comparable across trades. A $300 winner on a full ES
contract and a $30 winner on a single MES look completely different by dollar P&L but are
mechanically identical trades — same setup, same risk profile, same outcome in meaningful terms.
If you mix position sizes across your journal (which every futures trader does), dollar P&L makes
your "best" trades and your "worst" trades look like the ones where you happened to be biggest,
not the ones where you executed best.

R fixes this. A +2R trade on one MES and a +2R trade on four ES are the same row in your R
distribution. They taught you the same lesson about the setup and the execution. When you ask
"what does my entry method actually earn me per attempt?" — which is the question that matters —
you're asking about R, and you need a metric that's comparable across position sizes or the
answer is just noise.

R also makes win-rate-versus-reward tradeoffs legible. A strategy with a 45% win rate and an
average winner of +2.2R beats a strategy with a 65% win rate and an average winner of +0.9R, and
looking at R makes that immediately obvious. Looking at dollars obscures it completely.

---

## Why R is especially better than percentages for futures

Percentages are how stock traders think, and they *almost* work for stocks because a share is a
share — one unit is one unit and 1% of account is 1% of account. In futures, this falls apart
because the units aren't uniform:

- One tick on **ZB** (30-year Treasury bond) is **$31.25**
- One tick on **CL** (crude oil) is **$10**
- One tick on **MES** (Micro E-mini S&P) is **$1.25**
- One tick on **ES** (E-mini S&P) is **$12.50**

Ten ticks of ZB makes you the same dollars as a hundred ticks of MES. "I'm up 2% on the day" on a
$50k funded account tells you absolutely nothing about whether you traded well — you might have
squeezed it out of a single ZB trade that moved twelve ticks, or you might have ground it out of
four well-executed MES trades. Those are completely different facts about your trading, and
percentage P&L erases the difference.

This is why percentage P&L does not appear anywhere in the app. Not on the dashboard, not on the
analytics page, not on the trade detail. Dollars and R, full stop.

---

## How the app computes R

The formula the app uses is:

```
initial risk (points) = |entry_price - stop_price|
initial risk (dollars) = initial risk (points) × point_value × contracts
R-multiple = (exit_price - entry_price) in points / initial risk (points)
```

(For a short trade, the direction of the subtraction flips, but the idea is the same.)

Two notes on the mechanics:

1. **Point value comes from the instruments table.** Migration 001 seeded the `instruments` table
   with common futures contracts and their exact `point_value = tick_value / tick_size`. The app
   reads from this table every time it computes risk or R, so as long as you pick the correct
   instrument on the trade form, the math is right.

2. **The risk override.** Sometimes the stop distance isn't actually what you were risking —
   you used a mental stop, a time stop, a size cap, or you were sizing based on something other
   than the visible stop. The trade form has a **Risk override** field that lets you enter the
   dollar risk manually. When set, the app uses that value as the denominator for R instead of
   the computed stop distance. The override is recorded on the trade row so you can review later
   whether your mental-stop discipline matches your thesis.

---

## Expectancy — the one number that summarizes everything

Once your journal has enough trades to be statistically meaningful, the single most useful number
is **expectancy**: the average R per trade, across all trades, winners and losers blended together.

```
expectancy = average R across all trades
```

If your expectancy is **+0.25R**, you earn a quarter of a unit of risk per trade on average. That's
a strategy worth running. If it's **−0.1R**, you're paying the market to tell you you're wrong
every time you click. A positive expectancy means the math says the strategy works; a negative one
means it doesn't, no matter how good you feel about your winners.

The analytics page reports expectancy prominently because it's the number that answers the
question "should I keep doing this?" Win rate, avg win, avg loss, profit factor — all of them
feed into expectancy and are interesting for diagnosing *why* it is what it is, but expectancy is
the bottom line.

---

## A concrete example

You short MES at 5800 with a stop at 5805. Your target is 5780. You're trading 4 contracts.

**Initial risk in points:** `5805 − 5800 = 5 points`
**Initial risk in dollars:** `5 × 5 × 4 = $100` (MES has a point value of $5)
**Planned R:R:** `(5800 − 5780) / 5 = 20 / 5 = 4.0R at target`

You take the trade. Price drops to 5790 and you cover there instead of at the full target.

**Actual P&L in points:** `5800 − 5790 = 10 points`
**Actual P&L in dollars:** `10 × 5 × 4 = $200`
**Actual R-multiple:** `10 / 5 = +2R`

The journal records the trade as a **+2R winner worth $200**, and your expectancy pulls one data
point toward that number. The fact that you *could* have had a 4R winner and left half on the
table is something the review step captures in **Exit discipline** and **Lessons**, not in R — R
is what happened, not what should have happened. Both numbers matter. Both live on the trade row.

---

## Related reading

- [Philosophy](../getting-started/philosophy.md) — the broader argument for R-first metrics
- [Plans and trades](plans-and-trades.md) — how the **Planned R:R** on the plan form uses the same math
- [The risk engine](the-risk-engine.md) — why knowing your initial risk in dollars is a prerequisite for pre-trade blockers
