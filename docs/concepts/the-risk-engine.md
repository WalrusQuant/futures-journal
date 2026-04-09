# The risk engine

Futures Journal runs a pre-trade risk check on every keystroke in the trade form, refuses to let you save trades that would violate a configured rule, and records the reason when you override a block — not to shame you, but so you can see your own discipline pattern over time.

The risk engine is the single feature that separates this app from a spreadsheet. A journal that
only *records* what you did is a postmortem tool — useful, but too late. A journal that tells you
before you click "save" that this trade would put you $300 below your drawdown floor is an
intervention, and intervention is what actually changes behavior. This page covers what the
engine checks, how the override flow works, and why every check behaves the way it does. The
canonical source is `src/lib/risk.js`.

---

## When it runs

The engine runs on every debounced keystroke in the trade form. As you type — entry price, stop
price, contracts, anything that could change the risk calculation — the **Risk check** panel at
the bottom of the form re-evaluates and updates in place. By the time you reach for **Log trade**,
you've already seen any blockers or warnings the engine has found, and you know whether the save
is going to go straight through or pop the override modal.

Under the hood, `assessDraft()` fetches everything it needs in parallel — the instrument, the
account's closed trades, the account's transactions, the account's open trades, today's realized
P&L — and calls the pure `evaluateTradeRisk()` function with a fully materialized context. The
whole round trip is a few tens of milliseconds, which is why it can run on every keystroke
without making the form feel laggy.

---

## The blockers

Blockers are hard stops. If the risk panel shows any blocker in red, the form refuses to save the
trade on the first click. You can still proceed, but only through the override modal (below).
Every blocker check is **opt-in per account** — if the relevant field on the account row is null
or zero, the check is skipped silently. You never get nagged about a rule you didn't configure.

### 1. Daily loss limit breach

Checked when the account has a non-zero **Daily loss limit** set. The formula is the **worst-case
today** calculation:

```
worst_case = today's realized P&L
           − sum of open-trade risk (every open trade stops out)
           − this trade's risk (this trade stops out)
```

If `worst_case < −daily_loss_limit`, the engine blocks. The rationale is: a daily loss limit is
not "how much have you lost so far," it's "if everything currently live goes wrong, how much are
you down at the worst point of the day." The engine plans for that worst case in advance so you
can't accidentally tip into a breach by adding one more trade to a pile of open exposure.

The blocker message spells out the gap: "Worst-case today would breach your daily loss limit by
$X," with a detail line showing what's realized, what's in open risk, and what this trade would
add.

### 2. Max minis exceeded

Checked when the proposed trade is a **mini contract** (`is_micro = 0` on the instrument — ES,
NQ, CL, ZB, etc.) and the account has a non-zero **Max minis** value. The engine sums the
mini contracts already held across open trades, adds the proposed contract count, and blocks if
the total exceeds the cap.

Micro contracts are counted independently — if you have 40 MES open on an account with "Max minis
4, Max micros 40", proposing one more ES does not trip the max-minis check unless you'd already
have ES minis open. The two caps are enforced separately, on purpose, because firms size them
separately.

### 3. Max micros exceeded

Checked when the proposed trade is a **micro contract** (`is_micro = 1` — MES, MNQ, MCL, MGC,
etc.) and the account has a non-zero **Max micros** value. Same mechanic as max minis, but on the
micros side of the split.

### 4. Drawdown floor breach

Checked when the account is funded (`type = 'funded'`, i.e. combine, sim-funded, or live-funded)
and has a drawdown rule configured. The question: if this trade's stop hits right now, would the
resulting balance fall below the computed drawdown floor?

```
worst_balance = current_balance − this trade's risk in dollars
if worst_balance < drawdown.floor: BLOCK
```

The engine uses the live result of `computeDrawdownFloor()` — the same function the headroom
stat and the dashboard warning banner use — so it accounts for the account's drawdown mode
(static, EOD trailing, intraday trailing), any active lock offset, and the lock-on-payout
trigger. See [Drawdown modes](drawdown-modes.md) for the floor computation itself.

One deliberate design choice: this check considers **only this trade's risk**, not the combined
worst-case with open trades. The reasoning is that open trades may still close in profit — it's
unfair to assume every open trade stops out when checking a drawdown rule that operates on
realized balance. The daily loss limit check does combine with open risk because that's how the
daily loss rule actually works; the drawdown check doesn't because that's not how the drawdown
rule actually works.

---

## The warnings

Warnings are soft — they appear in the Risk check panel but they do not block the save. The form
goes through on the first click even if warnings are present. The point of a warning is to make
you look up, not to stop you.

### Risk > 2% of account size

```
warn if (this trade's risk in dollars / account.account_size) > 0.02
```

The classic sizing guideline — most risk management literature pegs per-trade risk at under 2%
of account equity. The message reports the exact percentage and reminds you where the guideline
comes from. You'll see this a lot when you're trading small accounts with normal position sizes,
which is itself useful information.

### This trade alone risks > 50% of daily loss limit

```
warn if this trade's risk > daily_loss_limit × 0.5
```

If a single trade can eat half your daily loss limit by itself, you only get two of them before
the day's over. The engine flags this so you can make the tradeoff deliberately — sometimes the
setup is worth it, sometimes it isn't, but either way you're not going to accidentally size into
a position where two stop-outs ends your day.

---

## Consistency rule — display only, not a blocker

The **Consistency limit (%)** field on the Rules tab lets you record a consistency rule where
your best trading day must stay under a given percentage of your total profit (e.g. "no single
day more than 30% of total profit"). This is a real rule at firms like Apex, and the app surfaces
its status on the dashboard and the account detail page via the `consistencyStatus()` analytics
function.

But **it is not a pre-trade blocker, by design.** A consistency rule is inherently end-of-day
math — you can't know whether today's P&L will violate the rule until you know what the final
total is, and you don't know the final total until the session closes. Any pre-trade check would
have to make assumptions about the rest of the day's trading that would almost always be wrong,
and the app refuses to generate false blockers.

The consistency display will tell you when you're getting close or when you've already
breached, so you can make an informed decision about whether to press or back off for the day —
but the decision is yours. The engine doesn't make it for you because it can't.

---

## The override flow

When you hit **Log trade** with a red blocker showing, the form does not save. Instead, it opens
the **Risk check failed** modal with:

- A summary of every blocker, including the detail text
- A checkbox that says "I understand the risk and want to proceed anyway"
- A textarea labeled **Reason (optional, but recommended)** with placeholder text suggesting
  something like "High-conviction setup, smaller size than usual"
- Two buttons: **Cancel** and **Override and log trade** (disabled until the checkbox is ticked)

You cannot click the override button without ticking the checkbox. If you cancel out of the
modal — by clicking Cancel, pressing Escape, or closing the modal — the trade is not saved and
you return to the form.

If you proceed, the override reason is written to the `trades.risk_override` column on the trade
row. The trade detail page then shows a "Risk override recorded" panel with the reason you gave
(or "(no reason given)" if you left the textarea empty), and the trade is otherwise saved
normally.

---

## Why overrides are recorded

This is the part of the engine that people sometimes misread as judgmental. It isn't. The
engine records overrides for a single reason: **so you can see your own pattern over time.**

Overrides happen. Sometimes you have a legitimate reason to take a trade that tripped a blocker —
a mental stop you sized against, a high-conviction setup you're willing to risk extra room on, a
recovery trade where you're deliberately stretching the daily loss limit because you have
conviction about the next setup. These are defensible choices, and the engine doesn't stop you
from making them.

But they're also the trades most responsible for the worst days in a prop trader's career, and
being able to look back at a month and see *how many times* you overrode, and *what you said*
when you did, is the feedback loop that lets you notice the pattern before it becomes a habit.
The reason textarea is where you're honest with future-you. If every override reason you've
written for the last month says some variant of "felt strongly about this setup" and half of
those trades were losers, the log is going to tell you.

The override mechanism is not a judgment. It's a mirror.

---

## Related reading

- [Drawdown modes](drawdown-modes.md) — how the drawdown floor is actually computed, which the engine relies on
- [R-multiples](r-multiples.md) — the risk number the engine uses is also the denominator for R
- [Plans and trades](plans-and-trades.md) — why the trade form's linkage to plans lets you compare overridden trades against your original plan
- [Overriding a risk block](../guides/overriding-a-risk-block.md) — the step-by-step walkthrough when a block does come up
