-- Phase 7.2: risk guardrails.
-- When a user overrides a blocking risk check, the reason they provided
-- (or just "(no reason given)") is stored here so reviews can see that the
-- trade was taken despite the app flagging it.
ALTER TABLE trades ADD COLUMN risk_override TEXT;
