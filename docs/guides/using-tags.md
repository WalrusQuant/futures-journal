# Using tags

Tags are how you slice your performance after the fact, and picking categories that survive across trades — strategy, setup, condition, mistake — is how tags become statistically meaningful instead of label clutter.

---

## The four categories

Every tag lives in exactly one of four categories. The categories are hardcoded — you can't add new ones —
because the whole point is that they're a shared taxonomy that survives across your entire trade history.

- **Strategy** — the high-level thing you're trying to do. Momentum, mean reversion, breakout, fade.
- **Setup** — the specific pattern that triggered this particular trade. Opening drive, VWAP reclaim, range
  breakout, news fade, trend pullback.
- **Condition** — the market state the trade happened in. Trend day, chop, low volume, FOMC, news window,
  post-gap, overnight inventory long.
- **Mistake** — something you did wrong that you want to track. Chased entry, moved stop, oversized, FOMO,
  ignored plan, cut winner early, held too long.

Strategy is *what you're doing*. Setup is *which version of that*. Condition is *the context around it*.
Mistake is the failure mode. Most trades get a strategy tag and a setup tag at minimum; condition tags are
optional context, and mistake tags get added during the post-trade review when you realize what went wrong.

## Create a tag

1. Click **Tags** in the sidebar
2. Click **+ New tag**
3. **Name**: what you'll call it — `Momentum`, `VWAP reclaim`, `FOMC`, `Moved stop`
4. **Category**: pick one of the four
5. **Color**: click one of the ten color swatches
6. Click **Create tag**

The tag appears in its category group on the Tags page. You can edit any tag later to change its name,
color, or category — edits propagate to every trade and plan it's attached to.

## Apply tags to trades and plans

Tags are applied via the tag picker, which is a multi-select chip widget. You'll see it:

- On the **trade form** (when creating or editing a trade)
- On the **plan form** (when creating or editing a plan)

Click a chip to toggle it on or off. The currently selected tags are highlighted with their color. There's
no limit on how many tags you can apply to a single trade or plan, but in practice most trades carry two or
three — too many is a smell that you're tagging noise.

On the **trade detail page** and the **plan detail page**, applied tags are rendered as static colored
chips in the main card. On the **trades list** and **plans list**, they appear as small chips under the
instrument symbol in each row, so you can scan down the table and see the shape of your trades at a glance.

## How analytics uses tags

On the **Analytics** page, tags drive a **per-tag breakdown** table — one row per tag, with count, win rate,
average R, total P&L, and other stats aggregated over all trades carrying that tag. This is where the whole
tag system pays off: after three months of consistent tagging, you can see that your `Momentum` trades have
a 62% win rate and your `VWAP reclaim` trades have a 45% win rate, and you can actually change your behavior
in response.

The analytics view-mode pill (**All / Real / Sim**) interacts with tag breakdowns — switch to Sim mode and
the per-tag stats are filtered to sim trades only, switch to Real and you see the same breakdown for cash
brokerage trades only.

## The anti-pattern: tag sprawl

Don't create a new tag for every variation of every setup. `VWAP reclaim after 9:30` and `VWAP reclaim
after 10:00` should be the same tag (`VWAP reclaim`) — the time-of-day context is captured separately by
the analytics hour-of-day breakdown.

Aim for **roughly 5–15 tags per category**. Fewer than five and the tag system is doing no work; more than
fifteen and most of your tags have too few trades attached to be statistically meaningful. A tag with three
trades on it tells you nothing. A tag with forty trades on it tells you something.

If you find yourself looking at your tag list and not knowing which one to apply, that's the sign you have
too many. Delete some. Consolidate. The point is coarse, durable labels — not a perfectly granular ontology
of every nuance of every setup.

## Deleting a tag

From the **Tags** page, click **delete** on the tag row. You'll get a confirmation dialog — delete removes
the tag from every trade and plan it's attached to (via `ON DELETE CASCADE` on the join tables). The trades
and plans themselves are unaffected; they just lose that tag.

This is safe. If you decide later you want the tag back, create it again — the historical tag associations
are gone, but you can re-apply the new tag to old trades if you really want to.

---

## What this actually records

Creating a tag writes a row to the `tags` table with:

- **`name`** — the trimmed string you entered
- **`color`** — the hex color value from the swatch you picked
- **`category`** — one of `strategy`, `setup`, `condition`, `mistake`

Applying tags to a trade writes rows to the `trade_tags` join table — one row per tag, each carrying
`trade_id` and `tag_id`. Applying tags to a plan writes rows to the `plan_tags` join table the same way
(plan tags were added in migration 003).

Both join tables cascade on delete: deleting a tag removes all its associations, and deleting a trade or
plan removes its tag associations. Tag counts per trade are handled with a `GROUP BY` in the trades/plans
list queries so row rendering can show tag chips without a second round-trip.

## Related reading

- [Writing a plan](writing-a-plan.md) — tagging a plan at creation time
- [Reviewing a closed trade](reviewing-a-closed-trade.md) — where `mistake` tags typically get applied
- [Plans and trades](../concepts/plans-and-trades.md) — the full loop the tags live inside
