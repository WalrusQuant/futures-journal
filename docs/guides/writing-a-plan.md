# Writing a plan

A plan is your commitment before the market moves, and the app refuses to save one without both a stop and a target.

If you're new to the plan → trade → review loop, read [Plans and trades](../concepts/plans-and-trades.md) first.
This page is the mechanical walkthrough: how to create a plan, what fields are required, and why the form is
shaped the way it is.

---

## Create a plan

1. Click **Plans** in the sidebar
2. Click **+ New plan**
3. **Account**: pick the account you'll take the trade on (bank accounts are filtered out — they can't hold
   plans)
4. **Instrument**: pick from the grouped dropdown (MES, ES, NQ, MNQ, CL, GC, etc.). The tick size, tick value,
   and point value for the selected contract are shown directly below the dropdown so you can sanity-check
   your math.
5. **Direction**: `Long` or `Short`
6. **Entry price**: where you'll get in
7. **Contracts**: how many
8. **Stop price**: where you're wrong
9. **Target price**: where you'll take profit
10. Optionally add **Tags** and a **Thesis**
11. Click **Create plan**

As you fill in the price fields, the card below the form updates live with **Risk** (dollars and points),
**Planned R:R**, and **Reward at target**. Watch these while you type — if your planned R:R is below 1.0, the
form will still let you save, but you should ask yourself why you're planning a trade with an unfavorable
risk/reward ratio.

## Why plans need both a stop and a target

An entry without a stop isn't a trade, it's a mistake. An entry with a stop but no target isn't a plan, it's
a hope. A plan is a complete thesis: *"I get in here, I'm wrong here, I'm done here."* If you can't fill in
the third part, you haven't thought the trade through yet, and the form reflects that by rejecting the
submission.

This is enforced in two places: the inline validator on the target field, and `validatePlanShape()` in
`src/lib/calc.js`. You can't save around it. The correct move when you can't pick a target is to wait until
you can, not to stretch the form into something it isn't.

The direction rules are also validated inline:

- For a **long**, the stop must be below entry and the target above entry
- For a **short**, the stop must be above entry and the target below entry

If you flip them the form will highlight the field and refuse to save. This catches the single most common
data-entry mistake — fat-fingering a stop above entry on a long — before it becomes a misleading row in the
database.

## Tags

The tag picker on the plan form is the same widget used on the trade form. Click a chip to toggle it. Tags
come from the four categories configured in **Tags** — `strategy`, `setup`, `condition`, `mistake` — and each
plan can carry any combination.

A common pattern: tag plans with **strategy** and **setup** tags (what you're doing), and tag trades with the
same plus any **condition** or **mistake** tags that turn out to apply after the fact. The tags you apply at
plan time persist with the plan forever, so analytics can slice "planned momentum trades" as a distinct bucket.

See [Using tags](using-tags.md) for the full taxonomy.

## Thesis

The thesis field is a textarea. It's optional, but it's the most valuable part of a plan if you're serious
about the loop, because it captures your reasoning before the market moves — which means it can't be
retroactively rewritten by your P&L afterward.

The point isn't to write an essay. A single sentence is enough:

> *Opening drive down, VWAP rejection at 5612, looking for continuation to overnight low.*

The test of a good thesis is whether you could hand it to a stranger and have them understand what you're
doing and why. If you can't explain it in one sentence, you probably don't have a clean enough read yet.

## Screenshots

Drop a chart screenshot into the **Screenshots** section on the plan form before you save. The image is
buffered in memory while the form is unsaved and committed to the plan row when you click **Create plan**.
See [Attaching screenshots](attaching-screenshots.md) for how the pending-then-committed flow works.

## Plan lifecycle

A plan moves through four states:

- **active** — the default state on creation. The plan is a live commitment you haven't taken yet.
- **taken** — a trade was opened against this plan. Set automatically when you take the plan via the trade
  form (see [Taking a plan](taking-a-plan.md)). A taken plan is **frozen** — you cannot edit its prices, stop,
  target, contracts, thesis, or tags. It's the historical record of what you committed to, and freezing it is
  how the analytics page can honestly compare planned prices against actual fills.
- **invalidated** — you decided not to take the plan because your thesis broke. From the plan detail page,
  click **Invalidate**. You can later **Reactivate** an invalidated plan if the thesis re-forms.
- **expired** — similar intent to invalidated, used when the window you were waiting for has passed. The app
  doesn't auto-expire plans — it's a manual state for your own record-keeping.

The **Plans** page has tabs for **Active**, **Taken**, **Invalidated**, and **All** so you can switch views.

## Editing a plan

While a plan is **active**, you can edit it from the plan detail page via the **Edit** button. Every field is
editable. Save changes and the plan stays active with the updated values.

While a plan is **taken**, the form refuses to open for edit and shows a "Plan locked" message. If you need to
correct something about the trade that was taken against it, edit the trade instead — the trade row is the
editable surface, the plan row is the frozen commitment.

Invalidated plans can be reactivated (which unfreezes them back to active), but while in the invalidated state
they're read-only.

---

## What this actually records

Creating a plan writes a row to the `plans` table with:

- **Refs**: `account_id`, `instrument` (symbol, not FK), and `trade_id` set to `null` until a trade is taken
- **Shape**: `direction`, `entry_price`, `stop_price`, `target_price` (the column is `NOT NULL` — this is
  where the "plans require a target" rule is enforced at the database level), `contracts`
- **Computed**: `rr_planned`, calculated from the three prices at save time
- **Metadata**: `thesis`, `status` (defaulting to `active`), `created_at`
- **Tags**: one row per tag in the `plan_tags` join table (added in migration 003)
- **Screenshots**: one row per attached image in the `trade_images` table — the table is polymorphic and
  carries `plan_id` for plan-attached screenshots, leaving `trade_id` null

No transactions. No trades. Just a commitment.

## Related reading

- [Plans and trades](../concepts/plans-and-trades.md) — the full plan → trade → review loop and why it matters
- [Taking a plan](taking-a-plan.md) — the handoff from plan to trade
- [R-multiples](../concepts/r-multiples.md) — what Planned R:R means and why it's computed at plan time
- [Using tags](using-tags.md) — the four tag categories
- [Attaching screenshots](attaching-screenshots.md) — the pending-then-committed flow for plan images
