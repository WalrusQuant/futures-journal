# Recording subscription fees

Combine subs are real money out of your bank, and tagging them to the combine they cover is how the ledger answers "is this firm actually paying me?"

For the concept behind fee attribution, read [Fees and fee attribution](../concepts/fees-and-fee-attribution.md).
This page is the mechanical walkthrough for recording one.

---

## Record the fee

1. Click **Accounts** in the sidebar
2. Click into your **personal bank** account (or whichever real-money account the subscription is debited
   from)
3. Click **+ Add transaction** in the Transactions section header
4. **Type**: pick **Fee**
5. A second field appears: **Paid for account (optional)** — a dropdown of your active funded accounts
6. Pick the combine or funded account this subscription covers
7. **Amount ($)**: the subscription amount, always positive (the Fee type controls the sign)
8. **Date**: the date the sub was charged
9. **Note (optional)**: e.g. `monthly sub` or `Apex 50k eval sub`
10. Click **Add transaction**

The bank's current balance drops by the fee amount, the transaction appears in the Transactions table with a
red amount, and the ledger page now attributes this fee to the combine you selected.

## Why the Paid for account dropdown only appears for fee-style types

The dropdown is only visible for three transaction types: **Fee**, **Reset fee**, and **Activation**. These
are the three types that represent money you pay to the firm to maintain, reset, or activate a funded
account, so they're the three that can meaningfully carry a `paid_for_account_id` pointing at the funded
account they cover.

Deposits, withdrawals, and payouts don't carry this field — a deposit isn't paying for anything, and a
payout is the firm paying you.

The dropdown is optional. If you skip it, the fee still records against the bank's balance and still counts
on the real ledger's **Subscription fees** total — it just won't show up in the per-account fee burn
breakdown on the ledger page. If you want that breakdown to be useful, pick the account every time.

## Reset fees and activation fees

Same flow, different **Type**:

- **Reset fee** — you blew a combine drawdown rule and paid the firm to reset the account to its starting
  balance. Pick the combine in the Paid for account dropdown so the reset cost shows up alongside the
  subscription cost on the fee burn view.
- **Activation** — you passed a combine and paid the firm to activate the funded account. Same pattern.

All three show up separately on the **Ledger** page's totals tiles: **Subscription fees**, **Reset +
activation** (which aggregates both reset and activation types), and they all feed into the **Net real
money** total as outflows.

## What the fee burn view looks like

Once you've recorded a few fees tagged to a combine, navigate to **Ledger** and scroll to the **Fee burn by
account** table. Each row is one funded account (the target of `paid_for_account_id`), and the columns show
the total fees paid for that account, broken down by fee type.

Over a quarter, this is how you answer the question the two-ledger model exists to answer:

> *This combine has cost me $441 in subs and $80 in resets — for $1,800 of sim P&L against a $3,000 target
> I haven't hit yet. Am I making progress or bleeding money?*

The app won't answer the question for you — that's a judgment call — but it puts both numbers on the same
page, in the same format, so you can actually look at them together.

---

## What this actually records

Recording a subscription fee writes a single row to the `transactions` table with:

- **`account_id`** — the bank (or wherever the fee was charged from)
- **`type`** — `fee` (or `reset`, or `activation`)
- **`amount`** — the positive dollar amount
- **`occurred_at`** — the date you picked, as an ISO timestamp
- **`note`** — the optional note
- **`paid_for_account_id`** — the id of the combine/funded account you picked in the dropdown, or `null` if
  you left it blank
- **`linked_tx_id`** — `null`

After the insert, `recomputeBalance()` runs on the bank account and the balance drops by the fee amount.
The real ledger (`realMoneyLedger()` in `src/lib/ledger.js`) sees the transaction, classifies it by type
(`sub_fee` / `reset_fee` / `activation_fee`), and aggregates it into the correct totals tile. The
`feesByPaidForAccount()` helper walks the same events to build the per-account fee burn table.

## Related reading

- [Fees and fee attribution](../concepts/fees-and-fee-attribution.md) — why tagging a fee to a combine matters
- [The two ledgers](../concepts/the-two-ledgers.md) — where fee burn sits in the larger ledger model
- [Recording a payout](recording-a-payout.md) — the inflow side of the real ledger
- [Setting up your first account](setting-up-your-first-account.md) — the bank + combine shape this guide assumes
