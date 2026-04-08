-- Per-account drawdown calculation mode.
-- Existing accounts default to 'static' so their behavior is unchanged:
-- floor = account_size - trailing_dd, which is what the app has always done.
ALTER TABLE accounts
  ADD COLUMN drawdown_mode TEXT NOT NULL DEFAULT 'static'
  CHECK (drawdown_mode IN ('none','static','eod_trailing','intraday_trailing'));

-- When set, once peak equity reaches account_size + profit_target, the
-- trailing floor freezes at account_size (the classic "locks at initial
-- balance on target hit" rule used by several prop firms).
ALTER TABLE accounts
  ADD COLUMN dd_locks_at_target INTEGER NOT NULL DEFAULT 0;
