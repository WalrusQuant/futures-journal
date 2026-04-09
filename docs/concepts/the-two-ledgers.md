# The two ledgers

Futures Journal tracks two parallel ledgers — your simulated trading P&L and your actual real-money net worth — and never lets them contaminate each other. This is the most important concept in the app and the thing that makes it different from every other trading journal.

If you've used a journal that lumps everything together as "P&L," the two-ledger model will feel strange at first. Stick with it. The whole point of trading prop firm accounts is that the money in them isn't your money until it crosses a bridge into the real world, and the app refuses to pretend otherwise.

---

## The problem the two-ledger model solves

Imagine you're three months into a prop firm career. You're running:

- An Apex 50k combine — you're up $1,800 in simulated dollars
- A sim-funded account from a different firm — you're up $4,200 in simulated dollars and you took a $500 payout last month
- A small cash account at your real broker — you're up $620 in actual dollars

You've also paid:

- $147 × 3 = $441 in combine subscriptions
- $80 in reset fees (twice)

So... how much money have you actually made? "$1,800 + $4,200 + $620 = $6,620" is a comforting answer, but it's wrong in two directions:

- It **overcounts** by $6,000, because the $1,800 in the combine and the $4,200 in the sim-funded account are simulated dollars — paper P&L against firm rules. You can't withdraw them, you can't spend them, the firm can revoke them. They might *become* real money later, but they aren't right now.
- It **undercounts** the real situation, because the $521 you spent on subs and resets came out of your actual checking account and is gone.

The honest accounting is:

- **Real money:** $620 (cash trading) + $500 (payout received) − $521 (subs and resets) = **+$599 actual dollars**
- **Sim money:** $1,800 + $4,200 = **+$6,000 in simulated dollars** that *might* convert to real money via future payouts

Two numbers, not one. Both true. Neither contaminates the other. That's the two-ledger model.

---

## What's in each ledger

### The sim ledger

Every trade you take on a **combine**, **sim-funded**, or **live-funded** account, plus all the rule-tracking around it. This is what shows up on:

- The Today panel on the dashboard
- The trades list and analytics page (when filtered to simulated accounts)
- The drawdown room, daily loss limit, contract caps, and consistency rule UI
- The R-multiple distribution, profit factor, expectancy, and other performance stats

The sim ledger answers the question: **"Am I a profitable enough trader to pass combines, earn payouts, and not get my account yanked?"**

### The real ledger

Every actual dollar that moves in or out of your real life. Specifically:

- **Deposits** to a cash brokerage or your bank account (money you put in from outside)
- **Withdrawals** from a cash brokerage or your bank (money you took out)
- **Payouts** received from a sim-funded or live-funded account (the bridge from sim to real — see below)
- **Subscription fees** paid to prop firms (combine subs, monthly evals)
- **Reset and activation fees** paid to prop firms
- **Closed trade P&L** on cash brokerage accounts (your own money at a real broker)

The real ledger answers the question: **"How much actual money have I made or lost from all this?"**

It lives on the **Ledger** page (in the sidebar) and shows up as the "Real this month" stat on the dashboard.

---

## What crosses the bridge

The two ledgers are not connected by trade P&L. They're connected by exactly two events:

### 1. Payouts

When a sim-funded or live-funded account hits its payout threshold and the firm sends you actual money, you record that as a **payout** transaction on the funded account. The transaction has two effects:

- On the **sim ledger**, it reduces the funded account's balance (because the firm took the money out of the simulated account)
- On the **real ledger**, it shows up as money received

The funded account's *trade* P&L doesn't move into the real ledger — only the *payout* does. You could be up $10,000 in simulated dollars on a sim-funded account but if you've received zero payouts, your real ledger shows zero.

### 2. Cash account trading

If you have a category-`cash` account — your own money at Tradovate, NinjaTrader, AMP, IB, whatever — those trades are real money the moment they close. There's no bridge to cross because the trades *are* the bridge. Cash account P&L flows directly into the real ledger.

That's it. Two doorways. Everything else stays on its side of the wall.

---

## Why live-funded P&L doesn't count until withdrawn

This is the rule that surprises people the most, so it deserves its own section.

A **live-funded** account uses real firm capital — your fills hit the actual market. It feels like real money. But it isn't yours until you pull it out, because:

- The firm can revoke the account for a rule violation
- The firm can change rules retroactively (it has happened)
- The firm can go out of business (it has happened)
- The firm can dispute a withdrawal (it has happened)

Until your bank shows the wire, the money is conditional. The app refuses to count conditional money as net worth, because the entire point of the real ledger is to give you the *honest* picture.

This is also why the app has a separate `withdrawal` and `payout` distinction:

- A **payout** is requested money the firm has sent you. It hits the real ledger.
- Trade P&L on the live-funded account itself is sim ledger only, even though it's "real" in the sense that it represents real fills.

If you want to see your live-funded trade P&L, look at the sim ledger view (the analytics page filtered to simulated, or the account detail page). If you want to see what it's actually contributed to your net worth, look at the real ledger.

---

## What the bank account is for

The bank account category exists specifically to make the real ledger work cleanly. It's a real-money hub with no trading. You use it to:

- Receive payouts from funded accounts (they transfer in)
- Pay combine subscription fees (they show up as fee transactions)
- Pay reset and activation fees
- Move money to and from your cash brokerage accounts
- Optionally tag fees with `paid_for_account_id` so the ledger can break out fee burn per combine

If you skip the bank account and just record payouts directly against funded accounts, the real ledger still works — but you lose the central hub view, and it's harder to see fee burn at a glance. See [Setting up your first account](../guides/setting-up-your-first-account.md) for the recommended setup.

---

## Internal transfers don't count

When you transfer money from your bank to your cash brokerage, your net worth doesn't change — it just moved between two real-money pots. The app handles this by marking those transfers as **internal transfers** and excluding them from the "Net real money" total.

The mechanic: a transfer creates two linked transactions — a `transfer_out` on the source and a `transfer_in` on the destination. If both sides are real-money accounts, the pair is flagged internal and excluded from the ledger total. If one side is a sim account and the other is real, the real side counts (because that's the bridge — money actually moved into your real life).

See [Transferring between accounts](../guides/transferring-between-accounts.md) for the mechanics.

---

## Why this matters

The two-ledger model exists because the question every prop firm trader eventually has to answer is: **"After all the subs, resets, payouts, and time, am I net positive on this whole prop firm thing?"**

The naive answer — looking at your combined sim P&L — flatters you. You feel like you're up $6,000 because that's what the combines say. The honest answer is the real ledger total, and for most traders in their first year it's negative or near zero. That's not a bug. It's the truth, and the truth is what makes the journal worth running.

When the real ledger eventually crosses into clear positive territory — sustained, not just one good payout — that's when you know you've actually arrived. Until then, the sim ledger tells you whether you're trading well, and the real ledger tells you whether the ecosystem is paying you for it. They're different questions and they deserve different answers.

---

## Where this concept shows up in the app

- **Dashboard** — the "Real this month" stat is the real ledger. The Today panel cards are the sim ledger.
- **Ledger page** — entirely real ledger. Range pills, totals, curve, fee burn, events table.
- **Analytics page** — the **All / Real / Sim** view-mode pill at the top of the page lets you flip between the three reading modes.
- **Account detail** — funded accounts show sim balance and rule status. Cash and bank accounts show real balance.
- **Settings → Diagnostics** — confirms the data path so you know where both ledgers live.

## Related reading

- [Accounts and categories](accounts-and-categories.md) — the five categories and how they map to each ledger
- [Fees and fee attribution](fees-and-fee-attribution.md) — how to tag a fee paid from your bank to the combine it covers
- [Setting up your first account](../guides/setting-up-your-first-account.md) — the recommended bank-plus-combine starting setup
- [Recording a payout](../guides/recording-a-payout.md) — the most important sim-to-real bridge event
- [Transferring between accounts](../guides/transferring-between-accounts.md) — how internal transfers stay out of the real-money totals
