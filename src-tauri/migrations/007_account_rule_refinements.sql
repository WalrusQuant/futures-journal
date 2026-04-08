-- Drawdown lock rule: replaced the boolean dd_locks_at_target with a
-- nullable dollar offset so combine vs sim-funded vs no-lock are all
-- expressible from the same column.
--   null = no lock rule
--   0    = lock at starting balance (classic combine behavior)
--   >0   = lock at starting balance + offset (e.g. 100 for sim funded)
ALTER TABLE accounts ADD COLUMN dd_lock_offset REAL;
UPDATE accounts SET dd_lock_offset = 0 WHERE dd_locks_at_target = 1;
ALTER TABLE accounts DROP COLUMN dd_locks_at_target;

-- Sim-funded accounts commonly lock the floor the instant any withdrawal
-- or payout is recorded, regardless of whether the peak threshold has
-- been reached. Off by default.
ALTER TABLE accounts ADD COLUMN dd_lock_on_payout INTEGER NOT NULL DEFAULT 0;

-- Independent mini and micro contract caps. Firms size these separately
-- (e.g. 4 ES AND 40 MES). Back-fill existing max_contracts into
-- max_minis, since minis were historically the restrictive cap, then
-- drop the single-number column.
ALTER TABLE accounts ADD COLUMN max_minis INTEGER;
ALTER TABLE accounts ADD COLUMN max_micros INTEGER;
UPDATE accounts SET max_minis = max_contracts WHERE max_contracts IS NOT NULL;
ALTER TABLE accounts DROP COLUMN max_contracts;

-- Consistency rule: best day's profit cannot exceed consistency_pct %
-- of total profit. Stored as a plain percentage 0-100 (e.g. 30 = 30%).
-- Evaluated end-of-day, display-only (no pre-trade blocking).
ALTER TABLE accounts ADD COLUMN consistency_pct REAL;
