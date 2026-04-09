# Accounts and categories

Futures Journal uses five account categories to model the entire lifecycle of a futures trader working through prop firms, and picking the right category for each account is how the rest of the app knows what to do with your data.

Most other journals treat every account the same — a name, a starting balance, a list of trades.
That model falls apart the moment you're running a combine, a sim-funded account, and a personal
cash account side by side, because the P&L on each means something completely different. The
category picker exists so the app knows which ledger your trades belong in, which rules to enforce,
and which totals to count toward your net worth. See [The two ledgers](the-two-ledgers.md) for the
underlying money model — this page focuses on the five categories themselves.

---

## The five categories

When you click **+ New account** and open the form, the very first field is **Category**. That
choice controls everything downstream: which fields appear on the Rules tab, which ledger the
account contributes to, whether the account shows up in the trade and plan pickers, and what
"balance" even means for this row.

### Combine / Evaluation

**What it represents.** A simulated trading account you're paying a firm to let you trade, usually
with a monthly or one-time subscription fee, to prove you can follow their rules. Pass it and
you graduate to a funded account. Fail it and you start over.

**What trades on it are worth.** Simulated dollars. They count on the sim ledger. They never cross
into the real ledger on their own — only the subscription you paid (real) and any reset or
activation fees (real) touch the real ledger.

**What fees are real.** The monthly sub, any resets, any activation fee when you pass. All of
these are recorded as `fee`, `reset`, or `activation` transactions on your bank account, optionally
tagged with **Paid for account** pointing back at the combine. See
[Fees and fee attribution](fees-and-fee-attribution.md).

**What the Rules tab looks like.** The full set: **Drawdown type**, **Drawdown amount**,
**Lock floor at starting +** (usually 0 for a combine — the floor locks at the starting balance
once you're $DD in the green), **Daily loss limit**, **Profit target**, **Max minis**, **Max
micros**, **Consistency limit**, and **Rules notes**.

**Real-world examples.** Apex 50k evaluation, Topstep 50k Combine, Tradeify Starter, MFFU Rally.

### Sim funded

**What it represents.** A simulated account that pays out real money. You passed a combine (or
bought a direct account), the firm activated a sim-funded account for you, and now you trade
simulated P&L to qualify for periodic withdrawals of actual money.

**What trades on it are worth.** Simulated dollars on the sim ledger. The payouts you request and
receive are what crosses the bridge into the real ledger — not the trade P&L itself. You could be
up $10,000 in simulated dollars and still have zero on the real ledger if you've never requested a
payout.

**What fees are real.** Usually a monthly activation fee or sub. Any resets if you violated a rule.
Logged against your bank, optionally tagged to this account.

**What the Rules tab looks like.** The same full set as a combine, but typically with **Lock floor
at starting +** set to something like 100 (the floor locks $100 above your starting balance
instead of at starting balance) and **Also lock on any withdrawal or payout** checked — because
sim-funded firms usually freeze the trailing drawdown the moment you take a payout.

**Real-world examples.** Apex PA account after passing the eval, Topstep Funded account, MFFU
Expert after rally.

### Live funded

**What it represents.** A real-capital account. Your fills hit the actual market through the
firm's broker. It feels like real money — and in a mechanical sense it is — but the firm still
controls the capital until you pull profit out.

**What trades on it are worth.** Simulated dollars on the sim ledger *until* you request a
withdrawal. This is the one that surprises people. Trade P&L on a live-funded account does not
touch the real ledger — only the payout/withdrawal does — because the firm can still yank the
account, change the rules, dispute the withdrawal, or disappear. The app refuses to count
conditional money as net worth.

**What fees are real.** Any firm-side fees (some live-funded setups have platform fees) and
whatever you pay for data if the firm doesn't cover it.

**What the Rules tab looks like.** The same full set. The rules still apply — live-funded accounts
still have drawdown, daily loss limits, and contract caps you have to respect.

**Real-world examples.** A Topstep Live account you earned your way into. An Earn2Trade live-funded
stage. Any firm's "real capital" offering.

### Cash brokerage

**What it represents.** Your own money at a real broker. No firm, no rules, no simulation — just
an account at Tradovate or NinjaTrader or AMP or IB with your cash on the line.

**What trades on it are worth.** Real dollars, immediately. Cash account P&L is the one kind of
trade P&L that flows directly into the real ledger because the money was yours to begin with and
there's no bridge to cross.

**What fees are real.** Commissions and data fees (set per trade via the `fees` field on the trade
form if you want to track them). Monthly platform fees would be logged as transactions.

**What the Rules tab looks like.** There isn't one — or more precisely, the drawdown/daily loss/
contract cap fields are all optional and usually left blank. Nothing's enforcing rules on your own
money except you.

**Real-world examples.** A personal Tradovate account. An Interactive Brokers futures account.

### Personal bank

**What it represents.** Your actual bank account — the real-money hub that feeds everything else.
Chase, Ally, whatever you use. You only need one, but you can have more if your finances are split.

**What trades on it are worth.** Nothing. Bank accounts don't trade. They're deliberately excluded
from the trade and plan pickers so you can't accidentally log a trade against them.

**What fees are real.** Everything — this is usually where you record outgoing combine subscriptions,
reset fees, and activation fees, and where incoming payouts land.

**What the Rules tab looks like.** There isn't one. The Rules tab is hidden entirely for bank
accounts.

**Real-world examples.** Your checking account. Your operating account. Your "prop trading money"
savings bucket.

---

## Why categories exist

The five categories collapse down to two fundamental questions the rest of the app needs to answer:

1. **Sim ledger or real ledger?** Combine, sim-funded, and live-funded belong to the sim ledger.
   Cash and bank belong to the real ledger. The **Analytics** page's view-mode pill (**All /
   Real money / Simulated**) filters by this split, and the `/ledger` page builds its totals by
   looking at category.

2. **Does this account trade?** Combine, sim-funded, live-funded, and cash all do.
   Bank does not. Anywhere the app needs a list of accounts a user could log a trade against
   (the trade form, the plan form, pickers on analytics), bank accounts are filtered out.

Every feature of the app keys off one of these two questions, and category is what answers both.

---

## Legacy `type` column, briefly

If you read the source or a migration, you'll see the `accounts` table has two classification
columns: `type` (`funded` or `cash`) and `category` (`combine`, `sim_funded`, `live_funded`, `cash`,
`bank`). The `type` column is legacy — it existed before categories were introduced in migration
008. The risk engine still reads it, so the app keeps both columns in sync automatically:
**`category` is the source of truth and `type` is derived** on every write. You will never see
`type` in the UI and you never need to think about it unless you're modifying the rule engine
itself. The two columns cannot drift.

---

## Archived accounts

Every account has an **is_active** flag. When you click **Archive** on an account, `is_active`
becomes 0 and the row stays in the database — trades, plans, reviews, transactions, and risk
overrides all stay put. That's the whole point of archive over delete: a failed combine is a
record of what happened, and throwing it away is exactly the wrong response.

Archived accounts are hidden by default from:

- The Today panel on the dashboard
- The trade form's account picker
- The plan form's account picker
- The analytics page (unless you tick **Include archived**)
- The command palette's account list

They still show up on the Accounts page if you switch the view to include them, and their trades
still appear in analytics once you opt in. This is the pattern: archive for historical review,
delete only if the account was genuinely created in error.

If you archive a combine and then, say, take a reset and want to restart it, you can **unarchive**
it from the account detail page.

---

## A typical setup

A sensible starting configuration for someone just getting serious about prop firm trading is
three accounts:

1. **Personal bank** — your real bank, one row, ledger-only hub
2. **Combine / Evaluation** — the eval you're currently pushing through
3. **Sim funded** — the funded account you'll graduate into (create it the day you pass)

That's enough to exercise every part of the app: the Rules tab for the combine and sim-funded, the
real ledger for the bank, the two-ledger split on analytics, fee attribution from the bank back to
the combine, and the eventual payout that bridges sim to real.

Over time you'll accumulate more accounts — additional combines, maybe a cash account at a real
broker, the occasional archived failure. That's normal. The category picker handles it cleanly as
long as you pick honestly.

---

## Related reading

- [The two ledgers](the-two-ledgers.md) — why sim and real money don't mix, and what crosses the bridge
- [Drawdown modes](drawdown-modes.md) — the three trailing modes plus lock offsets, used by combine and funded accounts
- [The risk engine](the-risk-engine.md) — how the Rules tab values become pre-trade blockers
- [Fees and fee attribution](fees-and-fee-attribution.md) — tagging bank-paid fees to the combine they cover
- [Setting up your first account](../guides/setting-up-your-first-account.md) — step-by-step for the typical setup above
- [Archiving a failed combine](../guides/archiving-a-failed-combine.md) — how and why
