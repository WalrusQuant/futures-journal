# Quickstart

Five minutes from a fresh install to your first reviewed trade. This walks you through the minimum viable setup: a personal bank account, a combine, a plan, a trade, and a review. You'll learn the shape of the app by doing the work once.

If you haven't installed the app yet, start with [Install and first launch](install.md).

---

## What you'll do

1. Create a personal bank account (your real-money hub)
2. Create a combine account with rules
3. Write a plan for a setup you're watching
4. Log the trade when it triggers
5. Close the trade and review it

By the end you'll have data in every part of the app and a working mental model of how the pieces connect.

---

## 1. Create your bank account

The bank account is your real-money hub. Every dollar you deposit, withdraw, get paid out, or pay in fees flows through it. You only need one.

1. Click **Accounts** in the sidebar
2. Click **+ New account**
3. In the **Category** dropdown, pick **Personal bank**
4. **Name**: whatever you call it — `Chase`, `My bank`, `Operating`
5. **Account size**: your current balance in that account
6. Click **Create account**

The Rules tab is hidden for bank accounts because you don't trade on them. They're ledger-only.

> **Why this matters.** The bank account is what makes the [real money ledger](../concepts/the-two-ledgers.md) work. When you eventually pay a combine subscription or receive a payout, the money lives here.

## 2. Create your combine

Now the account you'll actually trade on.

1. From **Accounts**, click **+ New account** again
2. **Category**: pick **Combine / Evaluation**
3. **Name**: something specific — `Apex 50k #1`, not `Combine`
4. **Prop firm**: pick yours from the dropdown
5. **Account size**: the starting balance the firm gave you (e.g. `50000`)
6. Switch to the **Rules** tab
7. Fill in your firm's rules:
   - **Drawdown type**: usually **End-of-day trailing** for Apex, **Intraday trailing** for Topstep, **Static** for some
   - **Drawdown amount**: e.g. `2500` for an Apex 50k
   - **Lock floor at starting +**: `0` for a combine (the floor locks at starting balance once you reach it)
   - **Daily loss limit**: leave blank if your firm doesn't have one
   - **Profit target**: e.g. `3000` for an Apex 50k
   - **Max minis** and **Max micros**: the firm's contract caps (these are independent — 10 minis OR 50 micros, not both)
8. Click **Create account**

Don't sweat the rules right now if you're not sure. You can edit any of them later. If your firm has a rule the form doesn't model, drop it in the **Rules notes** field as a reminder to yourself.

> **Confused about the rule fields?** See [Configuring prop firm rules](../guides/configuring-prop-firm-rules.md) for a per-firm walkthrough.

## 3. Write a plan

A plan is a setup you're committing to before the open. The app requires both a stop and a target — if you can't pick them, you don't have a plan, you have a hope.

1. Click **Plans** in the sidebar
2. Click **+ New plan**
3. **Account**: your combine
4. **Instrument**: e.g. `MES` (Micro E-mini S&P)
5. **Direction**: long or short
6. **Entry price**: where you'll get in
7. **Stop price**: where you're wrong
8. **Target price**: where you'll take profit
9. **Contracts**: how many
10. **Thesis**: a sentence or two on why this setup. The more honest the better.
11. Click **Create plan**

The form computes your **Planned R:R** live as you fill it in. If your R:R is below 1.0, the form lets you save it but you should ask yourself why.

> **Why plans first.** The [plan → trade → review loop](../concepts/plans-and-trades.md) is the single biggest behavioral change this app encourages. Logging trades without plans is fine for a while, but the dashboard will eventually start showing you that your unplanned trades have a different P&L profile than your planned ones — and that's the whole point.

## 4. Log the trade

When the setup triggers and you take the trade:

1. From the plan detail page, click **Take trade**
2. The trade form opens pre-filled from the plan
3. Fill in **Entry time** (defaults to now) and adjust **Entry price** if your fill was different from the plan
4. Watch the **Risk check** panel below the form. It shows:
   - Your daily loss budget (if you set one)
   - Your open risk on this account
   - This trade's risk
   - Any **blockers** (red — would violate a rule) or **warnings** (amber — soft caution)
5. If everything is green, click **Log trade**

If the risk panel shows a red blocker, the form will prompt you to override on save. You can override — but the override and your reason get recorded on the trade so you can see your discipline pattern over time. See [Overriding a risk block](../guides/overriding-a-risk-block.md).

> **Why the risk engine catches this stuff.** The whole point is to refuse to let you blow up an account because you weren't paying attention. See [The risk engine](../concepts/the-risk-engine.md).

## 5. Close and review

When the trade exits — at your target, your stop, or wherever you actually got out:

1. Open the trade from **Trades** or the dashboard
2. Click **Edit**
3. Fill in **Exit time** and **Exit price**
4. Click **Save changes**

The trade is now closed. Your **R-multiple** and **P&L** are computed automatically from the prices, contracts, and instrument's point value. The dashboard's **Today** card updates immediately.

But you're not done. The trade lands in the **needs review** bucket and a banner appears on the dashboard. Click into the trade and:

1. **Plan followed**: yes / no / N/A
2. **Exit discipline**: 1 (panic) to 5 (textbook execution)
3. **Emotional state**: how you actually felt
4. **Lessons**: one honest sentence
5. Click **Mark reviewed**

That's it. The banner clears and the trade is fully logged.

> **Why review matters.** The 60-second post-trade review is the difference between a journal and a folder of trade tickets. The app will surface review coverage on the analytics page so you can see whether you're actually doing the work.

---

## What just happened

In five minutes you created data in every layer of the app:

- **Two accounts** — a real-money hub (bank) and a simulated trading account (combine) — connected to the [two-ledger model](../concepts/the-two-ledgers.md)
- **A plan** — a row in the `plans` table with required entry, stop, and target
- **A trade** — linked back to the plan, with its own risk assessment recorded at save time
- **A review** — execution quality and emotional state attached to the trade

The dashboard now has something to show you. The analytics page now has something to compute. The calendar now has a colored cell. The risk engine now knows what your open exposure is and will use it on the next trade.

## Where to go next

- Read [Philosophy](philosophy.md) to understand why the app is opinionated and what that means for how you'll use it
- Read [The two ledgers](../concepts/the-two-ledgers.md) — the most important concept in the app and the one that's least like other journals
- Read [Configuring prop firm rules](../guides/configuring-prop-firm-rules.md) if your combine rules don't fit cleanly into the form
- Read [Logging a scale-out trade](../guides/logging-a-scale-out-trade.md) when you eventually take partial profits and aren't sure how to record it
