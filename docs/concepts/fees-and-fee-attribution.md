# Fees and fee attribution

Futures Journal lets you tag a fee paid from your bank with the funded account it covers, so the ledger can show you exactly how much each combine has cost you in subscriptions and resets.

Prop firm fees are the hidden cost of the whole ecosystem. Every combine subscription, every
reset fee, every activation charge comes out of your real money and never comes back. If the
journal only records *that* you paid a fee, not *what it was for*, you end up with a bank-account
ledger full of fee transactions and no way to tell which combine is quietly bleeding you dry.
Fee attribution is how you fix that.

---

## The problem

Imagine you're running three combines in parallel — let's say a `Apex 50k`, a `Topstep 50k`, and
an `MFFU 100k`. All three have monthly subs, all three charge for resets when you bust them, and
all three get paid from the same Chase account.

If you record every fee as a simple "fee" transaction on your bank, the ledger shows you a tidy
list of expenses — $147, $150, $199, $80 reset, another $147, and so on — but nothing in that
list tells you that $374 of it went to the Apex 50k that you're now about to archive as a
failure. The per-combine accounting is lost the moment the money hits the bank.

Multiply by months, multiply by resets, multiply by the activation fees you pay when you pass an
eval, and you can't answer the question that matters most: **"Has this combine earned its keep?"**
A combine that's net-positive $1,200 on sim P&L but has burned $600 in fees is worth $600, not
$1,200. Without attribution, you can't tell the difference.

## The solution

The transaction form on the account detail page has a field called **Paid for account
(optional)** that appears **only for fee-style transaction types**: `Fee`, `Reset fee`, and
`Activation`. When you log one of those three from your bank (or from a cash account), the
**Paid for account** dropdown lists your active funded accounts — combines, sim-funded,
live-funded — and lets you pick the one this fee pays for.

The field is stored on the transaction row as `paid_for_account_id`, alongside the normal
`account_id` (which is where the money actually came from — the bank). The transaction still hits
the bank's balance, still shows up on the real ledger, still flows through the totals exactly
the way an untagged fee would. The tag is purely additional information: "this money left my
bank and was spent on the `Apex 50k` combine."

If you skip the field, the fee is still recorded — it just isn't attributed, and the per-account
fee burn table won't count it.

## How the ledger uses it

The `/ledger` page has a section called **Fee burn by account** that groups every tagged fee,
reset, and activation transaction by its `paid_for_account_id` and shows you a table with one
row per funded account:

| Account | Subs | Resets | Activations | Total |
|---|---|---|---|---|
| Apex 50k #1 | $294 | $80 | $0 | **$374** |
| Topstep 50k | $150 | $0 | $150 | **$300** |
| MFFU 100k | $199 | $0 | $0 | **$199** |

Now you can actually answer the question. The Apex 50k has cost you $374 in real money; if your
sim ledger for that account shows you're up $1,200, your net on the combine-as-investment is
$826. The Topstep 50k has cost you $300 and hasn't paid out yet, so the investment is currently
$300 in the hole waiting for the first payout to bridge back to real money. And so on.

The table uses the `fees_by_paid_for_account` computation in `src/lib/ledger.js`, which walks
every real-money transaction and bucketizes the ones that have a `paid_for_account_id` set.
Untagged fees don't show up here — they just count toward the overall "Subscription fees" and
"Reset + activation" tiles at the top of the ledger page.

## Why this matters

A combine that's net-positive on simulated P&L but net-negative on fees is an investment that
isn't earning its keep. The sim ledger view alone will flatter it — "look, you're up $1,200!" —
and hide the fact that you've spent $1,400 of actual money keeping the combine alive long enough
to get there. That's a losing trade on the whole prop firm experiment, and the only way to see
it clearly is to have both sides of the math on the same page.

Fee attribution is what puts them on the same page. The sim side tells you whether you're
trading well. The fee-burn side tells you whether the trading is worth the cost of admission.
Both numbers together tell you whether to press on, take a reset, or cut the account loose.

This is also why the **Paid for account** dropdown is limited to *funded* accounts specifically:
bank, cash, and archived accounts don't show up as targets. You can only attribute a fee to
something that could plausibly be the reason you paid the fee — a live prop firm account you're
currently subscribed to.

---

## Related reading

- [The two ledgers](the-two-ledgers.md) — the underlying sim-versus-real model that fee attribution supports
- [Accounts and categories](accounts-and-categories.md) — which categories can be tagged as targets and which can't
- [Recording subscription fees](../guides/recording-subscription-fees.md) — the step-by-step for logging a tagged fee
