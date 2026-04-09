# Archiving a failed combine

Failed combines archive — they don't delete — so the data stays and you can learn from it later.

---

## Archive vs. delete

The distinction is deliberate. Archiving hides an account from the places you don't want to see it in
day-to-day operation. Deleting would throw away the history, which is almost never what you actually want —
a blown combine is the most instructive kind of record you can have.

When you archive an account:

- It's **hidden** from the active accounts list on the **Accounts** page (it shows up in a separate
  **Archived** section at the bottom)
- It's **hidden** from the dashboard's **Today** panel, so your current working set stays clean
- It's **hidden** from the account picker on the trade form and the plan form, so you can't accidentally log
  new trades against it
- It's **hidden** by default from analytics and the ledger, but reveilable via the **Include archived
  accounts** toggle on the analytics filters

What stays:

- Every **trade** you logged against the account — every row, every field, every review
- Every **plan** you wrote against the account
- Every **transaction** on the account — subscriptions, resets, the failed balance
- Every **screenshot** attached to those trades and plans
- The account's own row, with `is_active = 0` and `archived_at` set to the time of archive

Nothing is deleted. The account is just out of your way.

## Archive a combine

1. Click **Accounts** in the sidebar
2. Click into the failed combine
3. Click **Archive** in the top-right (it's the red danger button next to **Edit**)
4. A confirmation dialog appears — confirm by clicking **Archive** again
5. The page refreshes, and the account moves from the active list to the **Archived** section

That's it. The combine is out of your active working set. If you had open trades on the account when you
archived it, they're still there — archiving doesn't close or delete trades — but they won't show up in the
open positions count on the dashboard because the account itself is hidden.

## Viewing archived accounts

Archived accounts appear in the **Archived** section at the bottom of the **Accounts** page. Click into one
exactly like an active account — you can still read all the rules, trades, transactions, and screenshots.

To see trades from archived accounts in **analytics**, open the analytics filters and check **Include
archived accounts**. This flips the filter to include all accounts regardless of archive state so you can
run reports across everything you've ever traded. It's off by default because most of the time you want
analytics filtered to what's currently live.

## Unarchiving

If you archived a combine by mistake — or you got a courtesy reset from the firm and the account is back in
play — click into it from the **Archived** section and click **Unarchive** in the top-right. The account
flips back to active, `archived_at` is cleared, and it reappears in all the pickers and dashboards.

## When you might want to actually delete instead

You don't. Archive is correct in almost every case. The only reasons to actually delete an account would be:

- You created it by mistake (wrong name, wrong category) and it has no trades or transactions on it — in
  which case it's simpler to edit it to be correct than to delete and recreate
- You're cleaning up test data or a duplicate from a seed script

There's no **Delete account** button in the UI for exactly this reason. If you genuinely need to remove an
account row, it's a database surgery task, not a normal user operation.

---

## What this actually records

Archiving an account runs an `UPDATE` on the `accounts` row:

- **`is_active`** — set to `0`
- **`archived_at`** — set to the current ISO timestamp

Unarchiving is the inverse: `is_active` back to `1` and `archived_at` back to `null`.

No trades, plans, transactions, or screenshots are touched. The account's `current_balance` continues to be
derived from `account_size + Σ(signed transactions) + Σ(closed trade P&L)` exactly as before — archiving
doesn't change the math, it just changes which UI surfaces include the account in their default queries.

The analytics and ledger pages check `is_active` (via `listAccounts({ includeArchived })`) and filter
accordingly. The dashboard's Today panel and the trade/plan form pickers always pass `includeArchived:
false`, which is why archived accounts disappear from those surfaces with no additional work.

## Related reading

- [Accounts and categories](../concepts/accounts-and-categories.md) — the lifecycle of an account
- [Setting up your first account](setting-up-your-first-account.md) — creating new combines to replace the one you archived
- [Recording subscription fees](recording-subscription-fees.md) — the fee burn view that lets you evaluate whether the combine was worth it
