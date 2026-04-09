# Transferring between accounts

The app handles transfers as linked pairs — one transaction on each side — and excludes internal transfers between two real accounts from the real ledger's net worth total.

For the conceptual backdrop, read [The two ledgers](../concepts/the-two-ledgers.md). This page is the
mechanical walkthrough plus the internals of how transfers actually work.

---

## Record a transfer

1. Click **Accounts** in the sidebar
2. Click into the source account (the account the money is moving *out of*)
3. Click **Transfer** in the Transactions section header (it's next to **+ Add transaction**)
4. The transfer modal opens:
   - **From**: pre-filled with the source account (can't be changed — that's what you clicked into)
   - **To**: pick the destination account from the dropdown
   - **Amount ($)**: always positive
   - **Date**
   - **Note (optional)** — e.g. `Monthly sweep to Schwab`
5. Click **Transfer**

Both accounts update immediately. The source balance drops by the amount, the destination balance rises by
the same amount, and both accounts' transaction tables show the corresponding row.

## Linked transfer pairs

Under the hood, a transfer inserts **two rows** into the `transactions` table:

- A `transfer_out` row on the source account (sign = -1, reduces the balance)
- A `transfer_in` row on the destination account (sign = +1, increases the balance)

Both rows are linked via the `linked_tx_id` column — the source row's `linked_tx_id` points at the
destination row's id, and vice versa. They're inserted in a single transaction: if the second insert fails
for any reason, the first one is rolled back and no orphan half is left behind. This happens in
`createTransfer()` in `src/lib/accounts.js`.

The upshot: you never have to worry about a transfer getting half-committed. Either both sides exist or
neither does.

## Internal transfers and the real-money total

When both sides of a transfer are **real-money accounts** (category `cash` or `bank`), the pair is flagged as
an **internal transfer** and excluded from the **Net real money** total on the ledger page.

Why: transferring money from your bank to your cash brokerage doesn't change your net worth — you just moved
it from one real-money pot to another. The per-account balances still update (the bank goes down, the
brokerage goes up, and the ledger event table still shows the event), but it's marked `internal_transfer`
in the ledger's event stream and explicitly excluded from `totals.net`.

The implementation is in `realMoneyLedger()` in `src/lib/ledger.js`: when it walks the transaction stream and
encounters a transfer pair, it checks whether *both* sides are real-money categories, and if so tags the event
`internal_transfer` and skips it when computing the net total.

## Cross-ledger transfers

When one side of a transfer is a sim account (combine / sim-funded / live-funded) and the other is a real
account (cash / bank), the transfer is **not** internal — it's a cross-ledger event, and the real side counts.

In practice this is the "manual payout" case: you transfer sim money from a sim-funded account to your bank.
The transfer shows up on the real ledger as an inflow. This works, but it's not the recommended way to
record a payout — the cleaner pattern is to use the **Payout** transaction type directly on the funded
account (see [Recording a payout](recording-a-payout.md)), because a payout carries semantic weight that a
generic transfer doesn't, and because payouts interact with the `dd_lock_on_payout` drawdown trigger that a
transfer can't reach.

If you're moving money *into* a sim account (which is unusual — most sim accounts start at a fixed size and
don't receive deposits), the transfer goes through but the sim side doesn't affect the real ledger.

## Deleting a transfer

Deleting either side of a linked transfer deletes **both sides**, atomically. Click the **delete** link next
to the `transfer_out` row or the `transfer_in` row — it doesn't matter which — and both rows go away. Both
accounts recompute their balances and the event vanishes from the ledger.

This is the right default: an orphaned half of a transfer would be worse than deleting both sides, because
one balance would be right and the other wrong with no obvious way to fix it.

---

## What this actually records

A transfer writes **two rows** to the `transactions` table in a single transaction:

- **Row 1 (source)**: `account_id` = source, `type` = `transfer_out`, `amount` = positive dollar amount,
  `occurred_at` = your date, `note` = your note, `linked_tx_id` = the id of row 2
- **Row 2 (destination)**: `account_id` = destination, `type` = `transfer_in`, same `amount`, same
  `occurred_at`, same `note`, `linked_tx_id` = the id of row 1

Both rows are linked bidirectionally. Both sides recompute their balances. If the second insert fails, the
first is rolled back and no row 1 exists either.

On the real ledger side, if both accounts are real (cash or bank), the pair is tagged `internal_transfer`
and excluded from the `totals.net` calculation but still visible in the event stream. If one side is sim
and the other is real, the real side counts as an inflow or outflow on the ledger.

The `transfer_out` / `transfer_in` transaction types and the `linked_tx_id` column were both added in
migration 009.

## Related reading

- [The two ledgers](../concepts/the-two-ledgers.md) — why internal transfers are excluded from net worth
- [Recording a payout](recording-a-payout.md) — the preferred way to move sim money into the real world
- [Setting up your first account](setting-up-your-first-account.md) — the bank/brokerage shape that makes transfers useful
- [Fees and fee attribution](../concepts/fees-and-fee-attribution.md) — the other half of real-money bookkeeping
