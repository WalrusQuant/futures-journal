# Reviewing a closed trade

The 60-second post-trade review loop — the part most journals skip, and the part that compounds.

This guide is the mechanical walkthrough for filling in the review form. For the *why* behind the loop, read
[Plans and trades](../concepts/plans-and-trades.md).

---

## When a trade needs review

Any trade that's **closed** and hasn't been reviewed yet sits in the review bucket. Specifically: the `trades`
row has `status = closed` and `review_completed = 0`. The two ways a trade lands there are:

- You edited an open trade to fill in the exit time and exit price, closing it
- The trade was created in a closed state (e.g. backfilled)

Reviewing is never automatic. If you close a trade and walk away, it stays in the bucket until you come back
and mark it reviewed.

## The review banner

The dashboard surfaces a "Needs review" banner at the top of the **Today** panel whenever the bucket is
non-empty. It shows the count ("3 trades") and links to `#/trades?needs_review=1` — a filtered view of the
trades list with only the unreviewed closed trades. Click any row to open the trade detail page and scroll
to the **Review** section.

Trade detail pages for unreviewed closed trades also carry a **needs review** badge next to the page title, so
you can tell at a glance whether you've already processed this one.

## Fill in the form

1. Open the trade (via the banner, the `?needs_review=1` filter, or just by clicking through from the trades
   list)
2. Scroll to the **Review** section
3. Fill in the four fields:
   - **Did you follow your plan?** — `Yes`, `No`, or `N/A`. Pick N/A if there was no plan to begin with or
     if the question genuinely doesn't apply.
   - **Exit discipline (1–5)** — 1 is panic or impulse, 5 is textbook execution. The help text under the
     field says the same thing. Be honest, not kind.
   - **Emotional state** — dropdown with five options: `Calm`, `Neutral`, `Anxious`, `Angry`, `Overconfident`.
     Pick the one that's closest; leave blank if none fit.
   - **Lessons** — a textarea. One honest sentence is the target. "I moved my stop and got punished for it"
     is worth more than three paragraphs of rationalization.
4. Click **Mark reviewed**

That's it. The review card flips from edit mode to summary mode, the "needs review" badge on the page title
changes to "reviewed", and the trade is removed from the dashboard banner's count (or the banner clears
entirely if that was the last one).

## The 60-second rule

The discipline is consistency, not depth. Most reviews should take less than a minute. If you find yourself
staring at the Lessons field for five minutes trying to extract some profound insight, you're probably
overthinking it — move on and come back later if something clicks.

What you're building is a corpus. One review isn't meaningful. Three hundred reviews are meaningful, because
three hundred data points about your exit discipline and your emotional state let you see patterns you'd
never notice one trade at a time. That pattern visibility is the whole point of the loop, and you only get
there by not skipping reviews — even when it feels like there's nothing to say.

A trade with an obvious read ("target hit, did nothing weird, calm") is a valid review. Click `Yes`, pick
`5`, pick `Calm`, type nothing in Lessons, click **Mark reviewed**, move on. The lack of drama is the data.

## Editing a review later

Once a trade is reviewed, the Review section displays a summary card instead of the form. If you want to
change something — maybe you thought more about the exit and realized it was actually a 3 not a 4, or you
want to add context you couldn't articulate in the moment — click **Edit review** in the top-right of the
summary card. The form re-opens with your previous values pre-filled. Save again and the updated review
overwrites the old one.

This is useful for the morning-after pass, when last night's trades feel different with a clear head. Don't
be precious about your first take.

---

## What this actually records

Submitting a review runs an `UPDATE` on the trade row, setting:

- **`review_completed`** — flipped to `1`
- **`reviewed_at`** — the current timestamp
- **`plan_followed`** — `1` for yes, `0` for no, `null` for N/A
- **`exit_discipline`** — integer 1–5, or `null`
- **`emotional_state`** — the string value (`calm`, `neutral`, `anxious`, `angry`, `overconfident`), or
  `null`
- **`lessons`** — the trimmed textarea contents, or `null`

No new rows. The review columns were added in migration 005 and live directly on the `trades` table, so the
review is part of the trade — not a separate entity. Deleting the trade deletes the review along with it.

The analytics page computes a **review coverage** stat (reviewed trades as a percentage of closed trades) so
you can see, at a glance, whether you're actually doing the work.

## Related reading

- [Plans and trades](../concepts/plans-and-trades.md) — why the review loop matters
- [Writing a plan](writing-a-plan.md) and [Taking a plan](taking-a-plan.md) — the two steps before this one
- [Logging a normal trade](logging-a-normal-trade.md) — the step that gets the trade into the bucket
- [Using tags](using-tags.md) — tagging reviewed trades with `mistake` tags is where a lot of the value lives
