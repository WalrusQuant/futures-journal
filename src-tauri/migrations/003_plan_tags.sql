-- Plans get tagged the same way trades do.
CREATE TABLE plan_tags (
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (plan_id, tag_id)
);
