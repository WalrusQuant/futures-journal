-- Phase 7.3: structured post-trade review.
-- A trade is "reviewable" once it's closed. The review flow is optional but
-- the dashboard will surface a queue of closed trades that haven't been
-- reviewed yet so you can build the habit.
--
-- review_completed is a hard flag (0/1) so we can cheaply filter the queue
-- without joining on the text fields. reviewed_at records when the review
-- was saved, which is useful for review-coverage analytics later.
ALTER TABLE trades ADD COLUMN review_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trades ADD COLUMN plan_followed INTEGER;          -- nullable bool: 1 yes, 0 no
ALTER TABLE trades ADD COLUMN exit_discipline INTEGER;        -- 1-5 rating
ALTER TABLE trades ADD COLUMN emotional_state TEXT;           -- calm|neutral|anxious|angry|overconfident
ALTER TABLE trades ADD COLUMN lessons TEXT;                   -- free-form "what did I learn"
ALTER TABLE trades ADD COLUMN reviewed_at TEXT;               -- ISO timestamp

CREATE INDEX idx_trades_review ON trades(review_completed);
