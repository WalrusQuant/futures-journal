-- Free-form text for rules that don't fit columns:
-- "no trading 2 min around news", consistency rules, scaling plans, etc.
ALTER TABLE accounts ADD COLUMN rules_notes TEXT;
