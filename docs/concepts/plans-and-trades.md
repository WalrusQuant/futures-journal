# Plans and trades

Futures Journal is built around a three-step loop — write a plan before the open, log a trade when the plan triggers, review the trade after it closes — and the whole app is arranged to make that loop unavoidable.

You can log trades without plans and the app won't stop you. But a trade without a plan behind it
is a data point with no context, and a journal full of context-free trades is a spreadsheet. The
three-step loop is the thing that turns the spreadsheet into a feedback mechanism. This page
explains why each step exists and how the pieces connect.

---

## The loop, in order

### 1. Plan — commit before the open

A **plan** is a setup you're committing to *before* the market moves. You pick an instrument, a
direction, an entry price, a stop price, and a target price. You write a one-sentence thesis.
You save it. Done.

The important part isn't the data. It's the *commitment* — writing the plan forces you to name
where you're wrong (the stop) and where you'd be right (the target) before emotion enters the
picture. The rest of the app assumes you did this. If you didn't, the unplanned-trade analytics
will eventually tell on you.

### 2. Trade — execute the plan

When the setup triggers and you take the entry, you open the plan's detail page and click **Take
trade**. The trade form opens pre-filled with the plan's instrument, direction, stop, target, and
contract count, and the new trade row gets linked back to the plan via `plans.trade_id`. Adjust
the entry price if your fill was different, check the **Risk check** panel, save.

The linking matters because it lets the analytics page separate trades that came from plans from
trades that didn't, and report the two groups side by side.

### 3. Review — look at what you just did

After the trade closes, it lands in the **needs review** bucket and a banner appears on the
dashboard until you handle it. You open the trade, fill in four short fields, and click **Mark
reviewed**. That's it — 60 seconds, one sentence of honesty about what you did right or wrong, and
the bucket clears.

The review loop is the least popular step and by far the most valuable one. Keep reading.

---

## Why plans require both stop AND target

The plan form will not let you save a row with only an entry and a stop. The `plans.target_price`
column is `NOT NULL` at the schema level, and the form validator rejects the save before it gets
that far. This is the single most common objection users have to the app, so the reasoning deserves
the space:

An entry with a stop but no target isn't a plan, it's a *defensive posture*. You've decided where
you're wrong, which is good, but you haven't decided what the trade is actually worth if you're
right. Without a target, there's no **Planned R:R** — the reward-to-risk ratio the form computes
live as you fill in the fields — which means you can't ask "is this setup worth taking?" before
you're in it.

In practice, "I'll see how it develops" turns into "I took a half-R winner on what should have
been a 3R runner" more often than it should. The app refuses to let you skip the commitment step
because skipping it is the behavior most responsible for the mediocre R distributions it's trying
to help you fix.

If you genuinely can't pick a target (say, a runner where you're planning to trail the stop), pick
a stretch target you're comfortable with as a placeholder. You're allowed to revise it as the
trade plays out — the plan is a commitment to *thinking*, not a contract.

---

## The plan lifecycle

A plan starts life as **active** and transitions to one of three terminal states:

- **taken** — you clicked **Take trade**, a trade row was created, and the plan now has a `trade_id`
  pointing at that trade. This is the happy path.
- **invalidated** — the setup fell apart before you could take it. Price action changed, news
  came out, the level got swept without a reaction — whatever the reason, you click **Invalidate**
  on the plan detail page to mark it so. You can reactivate it later if it comes back.
- **expired** — the plan is old enough that the setup isn't relevant anymore. (The app doesn't
  auto-expire plans; you mark them manually when you're cleaning up the Plans page.)

The status tabs on the Plans page — **Active**, **Taken**, **Invalidated** — let you browse each
state separately. The ratio of taken to invalidated over time is itself a useful number: if you
invalidate 80% of your plans, you're either being too aggressive about writing them or too picky
about pulling the trigger. Both are worth noticing.

---

## The "take this plan" handoff

Clicking **Take trade** on an active plan does three things atomically:

1. Opens the trade form with fields pre-filled from the plan
2. Passes `from_plan=<id>` in the URL so the form knows the origin
3. On save, writes the trade row and updates the plan's `trade_id` to point at the new trade

From the trade's side, the link shows up as a "From plan #N" reference on the trade detail page.
From the plan's side, the **Taken** badge replaces the action buttons. You can still edit the
trade after the fact — moving the stop, recording the exit, filling in the review — and the plan
link stays intact.

The reason the link matters is analytics. The app can now ask: "How did my planned trades perform
compared to my unplanned ones?" and give you two columns of stats — trade count, win rate, avg R,
expectancy, the lot. The answer is usually that unplanned trades have lower expectancy and higher
variance. If that's true for you, the analytics page will make it impossible to ignore.

---

## Planned vs unplanned

A trade is **planned** if its `plan_id` column is set. Unplanned otherwise. There's no third
category — either the trade came from a plan or it didn't.

The **Analytics** page has a **Planned vs unplanned** widget that shows the two groups side by
side so you can see the delta. This is the whole reason the plan→trade link exists: if it turns
out your unplanned trades are actually *better* than your planned ones, that's a signal to loosen
up your planning. If they're worse (the common case), it's a signal to stop taking trades you
didn't write up first.

---

## The review loop — 60 seconds of honesty

When a trade closes, it enters the **needs review** bucket — the dashboard surfaces this with a
banner and the trade gets a "needs review" badge in the list. Clicking into the trade and scrolling
down reveals the review form, which asks four short things:

- **Did you follow your plan?** — Yes / No / N/A
- **Exit discipline (1–5)** — 1 is panic or impulse, 5 is textbook execution
- **Emotional state** — how you actually felt while in the trade
- **Lessons** — one honest sentence about what you learned

Click **Mark reviewed**, the banner clears, the trade gets a "reviewed" badge, and you're done.
Total time: about a minute. The app then knows which trades you've examined and which you haven't,
and the analytics page reports **review coverage** as a percentage so you can see whether you're
keeping up.

Sixty seconds of honesty after every trade is the single behavioral change that separates a
journal from a folder of tickets. It's also the step that's easiest to skip, which is why the
dashboard banner exists — the app will nag you until you clear the bucket, because the value of
the review compounds and the cost of not doing it is invisible until you've already lost the
lesson.

---

## What the "needs review" bucket shows you

The review bucket has exactly one rule: a trade enters it the moment `status = 'closed'` and
leaves it the moment `review_completed = 1`. Nothing else. The dashboard banner shows a count,
and a deep link to the trades list filtered by the **Needs review only** checkbox. From there,
you review them in any order and the banner shrinks as you go.

If you want to batch-review a week's worth of trades on Sunday, that's fine — the app doesn't
care about timing, it cares about whether you closed the loop. The sooner the better, because
memory fades fast, but a delayed review is worth vastly more than no review.

---

## Related reading

- [Philosophy](../getting-started/philosophy.md) — why the app is opinionated about plans in the first place
- [R-multiples](r-multiples.md) — why **Planned R:R** on the plan form is the number to watch
- [The risk engine](the-risk-engine.md) — what the Risk check panel on the trade form is actually checking
- [Writing a plan](../guides/writing-a-plan.md) — step-by-step for the plan form
- [Taking a plan](../guides/taking-a-plan.md) — the handoff from plan to trade
- [Reviewing a closed trade](../guides/reviewing-a-closed-trade.md) — the 60-second walkthrough
