-- Transfers, activation fees, and fee linkage.
--
-- Widens the transactions.type CHECK to accept 'activation',
-- 'transfer_out', and 'transfer_in', and adds two nullable link columns:
--   linked_tx_id        — pairs the two sides of a transfer together
--   paid_for_account_id — tags a real-money fee (e.g. a combine monthly
--                         sub paid from the main bank) with the funded
--                         account it pays for, so analytics can show
--                         per-account fee burn.
--
-- Transfers are split into two directional types so recomputeBalance
-- can keep using its existing sign lookup (transfer_out = -1,
-- transfer_in = +1). A transfer from A to B becomes one transfer_out
-- row on A plus one transfer_in row on B, linked by linked_tx_id.
--
-- SQLite doesn't support modifying CHECK constraints in place, so we do
-- the canonical rename-and-copy rebuild. Nothing else foreign-keys into
-- transactions, so the rebuild is safe; the trades, plans, and accounts
-- tables are untouched.

CREATE TABLE transactions_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id          INTEGER NOT NULL REFERENCES accounts(id),
  type                TEXT NOT NULL CHECK (type IN (
                        'deposit','withdrawal','payout','fee',
                        'reset','activation','transfer_out','transfer_in'
                      )),
  amount              REAL NOT NULL,
  occurred_at         TEXT NOT NULL,
  note                TEXT,
  linked_tx_id        INTEGER REFERENCES transactions(id),
  paid_for_account_id INTEGER REFERENCES accounts(id)
);

INSERT INTO transactions_new (id, account_id, type, amount, occurred_at, note)
  SELECT id, account_id, type, amount, occurred_at, note FROM transactions;

DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;

CREATE INDEX idx_tx_account      ON transactions(account_id);
CREATE INDEX idx_tx_linked       ON transactions(linked_tx_id);
CREATE INDEX idx_tx_paid_for     ON transactions(paid_for_account_id);
