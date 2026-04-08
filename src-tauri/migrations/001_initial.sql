-- Futures Journal v1 schema
-- Opinionated: futures only, stops required, R-multiples first.

CREATE TABLE instruments (
  symbol      TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  exchange    TEXT NOT NULL,
  tick_size   REAL NOT NULL,
  tick_value  REAL NOT NULL,
  point_value REAL NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USD',
  category    TEXT NOT NULL,
  is_micro    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE accounts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('funded','cash')),
  broker           TEXT,
  prop_firm        TEXT,
  account_size     REAL NOT NULL,
  current_balance  REAL NOT NULL,
  trailing_dd      REAL,
  daily_loss_limit REAL,
  profit_target    REAL,
  max_contracts    INTEGER,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  archived_at      TEXT
);

CREATE TABLE tags (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL UNIQUE,
  color    TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('strategy','setup','condition','mistake'))
);

CREATE TABLE trades (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  instrument  TEXT NOT NULL REFERENCES instruments(symbol),
  direction   TEXT NOT NULL CHECK (direction IN ('long','short')),
  entry_time  TEXT NOT NULL,
  entry_price REAL NOT NULL,
  stop_price  REAL NOT NULL,
  target_price REAL,
  contracts   INTEGER NOT NULL,
  exit_time   TEXT,
  exit_price  REAL,
  fees        REAL NOT NULL DEFAULT 0,
  pnl_points  REAL,
  pnl_dollars REAL,
  r_multiple  REAL,
  status      TEXT NOT NULL CHECK (status IN ('open','closed')),
  confidence  INTEGER,
  notes       TEXT,
  plan_id     INTEGER,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE plans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL REFERENCES accounts(id),
  instrument   TEXT NOT NULL REFERENCES instruments(symbol),
  direction    TEXT NOT NULL CHECK (direction IN ('long','short')),
  entry_price  REAL NOT NULL,
  stop_price   REAL NOT NULL,
  target_price REAL NOT NULL,
  contracts    INTEGER NOT NULL,
  rr_planned   REAL NOT NULL,
  thesis       TEXT,
  status       TEXT NOT NULL CHECK (status IN ('active','taken','invalidated','expired')),
  trade_id     INTEGER REFERENCES trades(id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE trade_tags (
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);

CREATE TABLE trade_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id   INTEGER REFERENCES trades(id) ON DELETE CASCADE,
  plan_id    INTEGER REFERENCES plans(id) ON DELETE CASCADE,
  file_path  TEXT NOT NULL,
  caption    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  type        TEXT NOT NULL CHECK (type IN ('deposit','withdrawal','payout','fee','reset')),
  amount      REAL NOT NULL,
  occurred_at TEXT NOT NULL,
  note        TEXT
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_trades_account     ON trades(account_id);
CREATE INDEX idx_trades_instrument  ON trades(instrument);
CREATE INDEX idx_trades_entry_time  ON trades(entry_time);
CREATE INDEX idx_trades_status      ON trades(status);
CREATE INDEX idx_plans_account      ON plans(account_id);
CREATE INDEX idx_plans_status       ON plans(status);

-- Seed: common futures instruments.
-- point_value = tick_value / tick_size
INSERT INTO instruments (symbol, name, exchange, tick_size, tick_value, point_value, category, is_micro) VALUES
  ('ES',  'E-mini S&P 500',       'CME',   0.25,   12.50,  50.00,   'index',  0),
  ('MES', 'Micro E-mini S&P 500', 'CME',   0.25,    1.25,   5.00,   'index',  1),
  ('NQ',  'E-mini Nasdaq-100',    'CME',   0.25,    5.00,  20.00,   'index',  0),
  ('MNQ', 'Micro E-mini Nasdaq',  'CME',   0.25,    0.50,   2.00,   'index',  1),
  ('YM',  'E-mini Dow',           'CBOT',  1.0,     5.00,   5.00,   'index',  0),
  ('MYM', 'Micro E-mini Dow',     'CBOT',  1.0,     0.50,   0.50,   'index',  1),
  ('RTY', 'E-mini Russell 2000',  'CME',   0.10,    5.00,  50.00,   'index',  0),
  ('M2K', 'Micro E-mini Russell', 'CME',   0.10,    0.50,   5.00,   'index',  1),
  ('CL',  'Crude Oil',            'NYMEX', 0.01,   10.00, 1000.00,  'energy', 0),
  ('MCL', 'Micro Crude Oil',      'NYMEX', 0.01,    1.00,  100.00,  'energy', 1),
  ('NG',  'Natural Gas',          'NYMEX', 0.001,   1.00, 1000.00,  'energy', 0),
  ('GC',  'Gold',                 'COMEX', 0.10,   10.00,  100.00,  'metal',  0),
  ('MGC', 'Micro Gold',           'COMEX', 0.10,    1.00,   10.00,  'metal',  1),
  ('SI',  'Silver',               'COMEX', 0.005,  25.00, 5000.00,  'metal',  0),
  ('ZB',  '30-Year T-Bond',       'CBOT',  0.03125, 31.25, 1000.00, 'rate',   0),
  ('ZN',  '10-Year T-Note',       'CBOT',  0.015625, 15.625, 1000.00, 'rate', 0),
  ('6E',  'Euro FX',              'CME',   0.00005, 6.25, 125000.0, 'fx',     0);
