# Recording a payout

A payout is the moment sim money becomes real money, and recording it correctly is what makes the real ledger honest.

If the two-ledger model is new to you, read [The two ledgers](../concepts/the-two-ledgers.md) first. This
guide is the mechanical walkthrough for logging the single event that bridges them.

---

## The mental model

A payout is a **transaction**, not a trade. The firm takes sim money out of your sim-funded or live-funded
account and sends real money to you. There are two effects:

- The **funded account's balance** (sim ledger) drops by the payout amount, because the firm has extracted
  that profit from the simulated account
- The **real ledger** shows the same amount as money received, because it actually landed in your real life

Both effects come from a single transaction row. You don't need to log the payout twice, and you shouldn't —
if you record the payout on the funded account *and* also record a real-money transfer from the funded
account into your bank as a separate event, you'll double-count the money.

## Record the payout

1. Click **Accounts** in the sidebar
2. Click into the funded account the payout is coming from
3. Click **+ Add transaction** in the Transactions section header
4. **Type**: pick **Payout**
5. **Amount ($)**: the payout amount, always positive (the type controls the sign — Payout is a debit on the
   funded account)
6. **Date**: the date the payout was issued (not necessarily when it hit your real bank)
7. **Note (optional)**: anything useful for your records — `Q1 payout request`, `first payout`, etc.
8. Click **Add transaction**

The account detail page refreshes and you'll see:

- The new transaction in the Transactions table with a red amount
- The funded account's current balance reduced by the payout amount
- Any drawdown metric on the account updated to reflect the new balance

## What happens on the real ledger

Navigate to **Ledger** in the sidebar. The payout you just recorded appears in the event table (category
`payout_received`) and counts toward the **Payouts received** tile at the top of the page. The **Net real
money** total goes up by the payout amount.

This is the entire sim-to-real bridge, in one transaction. The funded account's *trade P&L* never touches
the real ledger — only the payout does. If you've been up $4,200 on a sim-funded account for three months
but haven't taken any payouts, your real ledger shows nothing from that account. The day you take a $500
payout, the real ledger shows +$500, and the funded account's sim balance drops to +$3,700.

## Drawdown lock-on-payout

If the funded account has the **Also lock on any withdrawal or payout** flag checked (common for sim-funded
accounts at firms that lock the trailing drawdown at the moment of first payout), the payout transaction
will lock the drawdown floor immediately — regardless of whether the peak threshold has been reached.

This is the rule Apex, for example, uses for sim-funded accounts: the first payout freezes the trailing
drawdown where it is. The app models this with the `dd_lock_on_payout` column on the account row, which you
configure once when you set the account up, and the drawdown engine honors it every time it walks the event
stream.

The visible effect is subtle but important: after the payout, the account detail page's **DD room** stat
shows the floor as **locked**, and the floor stops trailing the peak from that point forward. The floor will
still move to the locked value if you were running with a higher trailing peak, but it won't trail upward
with new highs.

See [Drawdown modes](../concepts/drawdown-modes.md) for a deeper treatment of the lock-on-payout trigger and
how it interacts with the other drawdown mechanisms.

## What about the real-money side of the wire?

You may be tempted to also add a transaction on your bank account for the incoming payout, to "close the
loop." Don't. The payout transaction on the funded account already counts on the real ledger — adding a
second row on the bank account would double the inflow.

If you want the money to visibly land in a specific real-money account (say, you want your bank balance to
reflect the incoming wire), the correct flow is:

- Record the **payout** on the funded account (this is the ledger-level event)
- Separately, record a **deposit** on the bank account for the same amount and same date

...but this *will* double-count on the ledger, which is almost never what you want. In practice most users
let the payout stand alone and treat the bank balance as a rough cash buffer rather than a perfect mirror of
every real-money event. If your bank balance drifts from reality because of this, periodically reconcile by
editing the bank's starting size or adding a one-off adjustment transaction.

---

## What this actually records

Recording a payout writes a single row to the `transactions` table with:

- **`account_id`** — the funded account
- **`type`** — `payout`
- **`amount`** — the positive dollar amount you entered
- **`occurred_at`** — the ISO timestamp of the date you picked
- **`note`** — the optional note, or `null`
- **`linked_tx_id`** — `null` (payouts aren't transfer pairs)
- **`paid_for_account_id`** — `null` (the fee-attribution column is irrelevant for payouts)

After the insert, `recomputeBalance()` runs on the funded account, deriving the new current balance from
`account_size + Σ(signed transactions) + Σ(closed trade P&L)`. Because payouts have a `-1` sign, the balance
drops by the payout amount.

On the real ledger side, `realMoneyLedger()` in `src/lib/ledger.js` sees the payout transaction (regardless
of whether the funded account is classified as sim-funded or live-funded) and emits a `payout_received`
event with the positive amount, which rolls up into the Net real money total.

## Related reading

- [The two ledgers](../concepts/the-two-ledgers.md) — why payouts are the primary sim-to-real bridge
- [Drawdown modes](../concepts/drawdown-modes.md) — the lock-on-payout trigger and how it freezes the floor
- [Recording subscription fees](recording-subscription-fees.md) — the other side of the real ledger: money going out
- [Transferring between accounts](transferring-between-accounts.md) — how transfers differ from payouts
- [Fees and fee attribution](../concepts/fees-and-fee-attribution.md) — companion concept for the ledger page
