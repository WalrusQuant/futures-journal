# Taking a plan

The handoff from a plan to the trade that executes it — one click on the plan detail page, a pre-filled trade form, done.

This guide assumes you've already written a plan. If you haven't, start with [Writing a plan](writing-a-plan.md).

---

## The handoff

1. Open **Plans** and click into the active plan you're about to take
2. Click **Take trade** in the top-right of the plan detail page
3. The trade form opens with these fields pre-filled from the plan:
   - **Account**
   - **Instrument**
   - **Direction**
   - **Entry price**
   - **Stop price**
   - **Target price**
   - **Contracts**
4. Adjust **Entry time** (it defaults to now) and any prices that differ from the plan because you got a
   different fill
5. Watch the **Risk check** panel below the form as you edit — blockers appear in red, warnings in amber
6. Click **Log trade**

That's the whole flow. The trade is saved with its `plan_id` column set, which does two things: it flips the
plan's status to **taken** (and freezes the plan), and it makes the trade appear with a "Plan link" row on the
trade detail page so you can click back to the plan that spawned it.

## If your fills didn't match the plan exactly

Take the plan anyway, with the actual fills. Override any price that differs. The link between the plan and
the trade is more valuable than the exactness, because analytics needs the linkage — not the price match — to
surface the planned-vs-unplanned breakdown.

A common case: you planned an entry at 5610 but the market moved before you could get filled and you ended up
in at 5611.50. The correct move is to take the plan and edit the **Entry price** to 5611.50 on the trade form
before saving. The plan row stays frozen at 5610 (so you can see later that the market moved on you), and the
trade row carries 5611.50 as the actual fill.

The same applies to the stop and target — edit them on the trade form to match what you actually worked with,
not what you originally planned. The plan's purpose is the historical record of your intent; the trade's
purpose is the historical record of what happened.

## If the risk engine blocks you

Sometimes you go to take a plan and the risk engine throws a blocker — maybe the drawdown floor is closer
than it was when you wrote the plan, or you've already taken losses today that ate into your daily loss limit.
The form will still let you save, but it'll prompt you to enter an override reason. See
[Overriding a risk block](overriding-a-risk-block.md) for how that works and why the override is recorded on
the trade row.

## If you abandoned the plan

Don't take it. Go back to the plan detail page and click **Invalidate** instead. The plan moves to the
**invalidated** state, the trade never gets created, and the plan stays on your record as a thesis that broke
before execution.

Invalidated plans are valuable data — over time they tell you how often your read changes after you commit to
it, which is a different kind of signal than win rate. Don't delete them.

If you later decide the original thesis was right after all, open the invalidated plan and click
**Reactivate** to move it back to the **active** state.

---

## What this actually records

Taking a plan and saving the trade form writes:

- **One row to `trades`** with all the usual trade columns (`account_id`, `instrument`, `direction`, entry
  time and price, stop, target, contracts, status `open`), plus `plan_id` set to the id of the plan you took
- **An UPDATE on the `plans` row** flipping `status` to `taken` and `trade_id` to the new trade's id, so the
  link is bidirectional
- **Risk assessment metadata** — if the risk engine flagged anything and you overrode, the override reason is
  stored on the trade row via the `risk_override` column

No new plan rows. No tag copying (tags stay on the plan; the trade gets its own tag set once you review it or
edit it). No screenshot copying either — plan screenshots stay on the plan, trade screenshots are attached
separately to the trade.

## Related reading

- [Writing a plan](writing-a-plan.md) — how to create the plan in the first place
- [Plans and trades](../concepts/plans-and-trades.md) — the full loop and why linkage matters
- [Logging a normal trade](logging-a-normal-trade.md) — the trade form when you're not taking a plan
- [Overriding a risk block](overriding-a-risk-block.md) — what happens when the risk engine says no
- [Reviewing a closed trade](reviewing-a-closed-trade.md) — the next step after the trade exits
