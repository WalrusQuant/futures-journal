-- Granular account category. `type` stays as funded|cash for the existing
-- rule engine (risk.js, computeHeadroom, computeDrawdownFloor); `category`
-- is additive and used by analytics + the upcoming real-money ledger.
--
-- Existing rows: type='funded' defaults to 'sim_funded' (the most common
-- active state — user will re-label combines and live-funded accounts via
-- the edit form). type='cash' maps 1:1 to 'cash'.
--
-- 'bank' is pre-included in the CHECK so phase 8.2 can insert bank
-- accounts without rebuilding the table.
ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'sim_funded'
  CHECK (category IN ('combine','sim_funded','live_funded','cash','bank'));
UPDATE accounts SET category = 'cash' WHERE type = 'cash';
UPDATE accounts SET category = 'sim_funded' WHERE type = 'funded';
