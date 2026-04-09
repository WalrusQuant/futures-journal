# Setting up your first account

The recommended starting setup is one personal bank account plus one combine, and this guide walks you through both — with the reasoning baked in so the shape makes sense.

The [Quickstart](../getting-started/quickstart.md) covers the same two clicks in a hurry. This page is the slower
version for when you want to understand why you're being nudged into this particular shape before you build
everything else on top of it.

---

## Why a bank account first

The bank account is the central real-money hub. It doesn't hold trades. Its whole job is to be the one place
every real dollar flows through — payouts received from funded accounts, combine subscription fees going out,
reset fees, activation fees, and any transfers to or from a real brokerage.

You could skip it. You could record payouts directly against your funded accounts and log fees wherever. The app
won't stop you. But the [real money ledger](../concepts/the-two-ledgers.md) gets noticeably harder to read that
way, because there's no central node to anchor the fee burn view, and fee attribution (tagging a combine sub to
the combine it covers) only works cleanly when the fee is logged on a real-money account.

Create the bank first, create the combine second, and from then on every real dollar has an obvious home.

## 1. Create the bank account

1. Click **Accounts** in the sidebar
2. Click **+ New account**
3. In the **Category** dropdown, pick **Personal bank**
4. **Name**: whatever you actually call it — `Chase`, `My bank`, `Operating`. One word is fine.
5. **Account size**: your current balance in that account right now. This is the starting point the real
   ledger anchors to.
6. Leave **Current balance** empty — it defaults to the account size
7. Click **Create account**

That's it. You'll notice the form only shows a **Basics** tab for a bank account — the **Rules** tab is hidden
entirely. Bank accounts don't trade, so they don't need a drawdown, a daily loss limit, a profit target, or
contract caps. Every rule field would be irrelevant and the form strips them out on save to make sure no stale
rule data hangs around.

You'll also notice bank accounts don't appear in the account picker on the trade form or the plan form. That's
intentional — they're ledger-only. If you want to record a fee or a deposit on the bank, you do it from the
account detail page via **+ Add transaction**, not via the trades page.

## 2. Create the combine

Now the account you'll actually trade on.

1. From **Accounts**, click **+ New account** again
2. **Category**: pick **Combine / Evaluation**
3. **Name**: something specific. `Apex 50k #1` beats `Combine` — you'll probably run more than one over time, and
   the name is the only thing that distinguishes them on the list.
4. **Prop firm**: pick yours from the dropdown. If you don't see it, pick **Other**.
5. **Account size**: the starting balance the firm gave you (e.g. `50000` for an Apex 50k)
6. Switch to the **Rules** tab
7. Fill in whatever you know:
   - **Drawdown type**: `Static`, `End-of-day trailing`, or `Intraday trailing` — see
     [Drawdown modes](../concepts/drawdown-modes.md) if you're not sure which one your firm uses
   - **Drawdown amount**: the dollar size of the trailing drawdown, e.g. `2500`
   - **Lock floor at starting +**: `0` for a typical combine (the floor locks at starting balance once you reach
     it). Leave empty if your firm never locks.
   - **Also lock on any withdrawal or payout**: leave unchecked for a combine (there are no payouts yet)
   - **Daily loss limit**: leave blank if your firm doesn't have one
   - **Profit target**: the dollar target that clears the combine, e.g. `3000` for an Apex 50k
   - **Max minis** and **Max micros**: the firm's contract caps. These are **independent** — `10` minis OR `50`
     micros, not a combined cap. If your firm only enforces one, leave the other blank.
   - **Consistency limit (%)**: if your firm enforces a best-day-under-N% rule, enter the N. Leave empty
     otherwise. This rule is display-only and doesn't block trades — see [The risk engine](../concepts/the-risk-engine.md).
8. **Rules notes**: free text for anything the form doesn't model. News restrictions, scaling plans, weekend
   holds — just write it here as a reminder to yourself.
9. Click **Create account**

Don't sweat getting the rules perfect on the first pass. You can edit any of them later via **Edit** on the
account detail page. The only thing you can't change retroactively is the `account_size` — that's the
historical starting point the balance derivation depends on.

For a per-firm walkthrough of the rule fields, see [Configuring prop firm rules](configuring-prop-firm-rules.md).

## 3. Verify the shape

Go back to **Accounts**. You should see both accounts in the active list:

- The **bank** row, tagged **Personal bank**, with its balance matching the starting size and no rules
  attached. Clicking in shows a **Basics** view, a transactions table, and **+ Add transaction** / **Transfer**
  buttons — no Rules section.
- The **combine** row, tagged **Combine / Evaluation**, with its balance matching the starting size. Clicking
  in shows the same Basics plus a **Rules** card listing everything you configured, plus DD room, profit-to-target,
  and (if you set it) consistency stats.

If the combine card doesn't show the rule fields you entered, switch to **Edit** and double-check the **Rules**
tab — a common mistake is filling things in then accidentally switching tabs before hitting **Create account**.

## Multiple combines

Just create more. The shape scales without extra ceremony. Name them so future-you can tell them apart —
`Apex 50k #1`, `Apex 50k #2`, `Topstep 100k`, `Tradeify 150k #1`. If one fails, archive it (see
[Archiving a failed combine](archiving-a-failed-combine.md)) instead of deleting; the data is more useful as
a record of what went wrong than as empty space.

Each combine has its own rules, its own balance, its own drawdown floor, and its own fee burn tally. The
dashboard's Today panel shows one card per active account, so when you're running three combines in parallel
you get three cards side-by-side with their independent headroom.

## Your real broker

If you trade your own money at a real broker (Tradovate, NinjaTrader, IB, AMP, whatever), add it as a separate
account with category **Cash brokerage**. Pick your broker from the dropdown, enter the starting balance, and
save. The rules tab is still available for a cash account — leave everything empty unless you want the risk
engine to enforce a self-imposed daily loss limit or contract cap.

Keep the cash brokerage separate from your personal bank. The bank is the real-money hub; the brokerage is
where real trades happen. They're two different real-money accounts, and transfers between them are handled
as internal transfers that don't affect net worth (see
[Transferring between accounts](transferring-between-accounts.md)).

---

## What this actually records

Creating these two accounts writes two rows to the `accounts` table. Each row carries:

- A **category** (`bank` for the personal bank, `combine` for the combine) — the source of truth for every
  downstream behavior: which ledger the row belongs to, whether it shows up in the trade form picker, whether
  the real money ledger counts its transactions.
- A derived **type** (`cash` for bank, `funded` for combine) — the legacy column the rule engine reads. The
  two columns are written atomically so they can't drift.
- A starting **account_size** and a derived **current_balance** equal to it.
- For the combine, all the rule columns you filled in on the Rules tab: `drawdown_mode`, `trailing_dd`,
  `dd_lock_offset`, `dd_lock_on_payout`, `daily_loss_limit`, `profit_target`, `max_minis`, `max_micros`,
  `consistency_pct`, `rules_notes`.
- For the bank, all of those rule columns set to `null` — the form strips them on save.

No transactions yet. No trades yet. Just two accounts, correctly shaped, ready to be the foundation for
everything that comes next.

## Related reading

- [The two ledgers](../concepts/the-two-ledgers.md) — why the bank + combine shape exists in the first place
- [Accounts and categories](../concepts/accounts-and-categories.md) — the full five-category model
- [Configuring prop firm rules](configuring-prop-firm-rules.md) — Apex, Topstep, Tradeify, and other firm specifics
- [Drawdown modes](../concepts/drawdown-modes.md) — static, EOD trailing, intraday trailing
- [Recording subscription fees](recording-subscription-fees.md) — the first thing you'll do on the bank account
