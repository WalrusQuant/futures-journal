#!/usr/bin/env python3
"""Generate realistic-looking test data for the futures-journal SQLite DB.

Idempotent on tags (skip if any exist) and additive on trades/plans.
Targets the first active account in the DB.
"""
import os
import random
import sqlite3
from datetime import datetime, timedelta, timezone

DB_PATH = os.path.expanduser(
    "~/Library/Application Support/com.adamwickwire.futuresjournal/futures-journal.db"
)

# Instrument specs the seed knows about. Symbol -> (point_value, base_price, vol).
INSTRUMENTS = {
    "MES": {"point_value": 5.0,   "base": 5600.0, "vol": 12.0,  "weight": 5},
    "MNQ": {"point_value": 2.0,   "base": 19500.0,"vol": 60.0,  "weight": 4},
    "MCL": {"point_value": 100.0, "base": 78.5,   "vol": 0.6,   "weight": 2},
    "MGC": {"point_value": 10.0,  "base": 2360.0, "vol": 8.0,   "weight": 2},
}
SYMBOLS = []
for sym, spec in INSTRUMENTS.items():
    SYMBOLS.extend([sym] * spec["weight"])

TAGS = [
    ("Momentum",   "#22d177", "strategy"),
    ("Pullback",   "#00d4ff", "strategy"),
    ("Breakout",   "#a78bfa", "strategy"),
    ("Reversal",   "#ec4899", "strategy"),
    ("ORB",        "#f59e0b", "setup"),
    ("Flag",       "#34d399", "setup"),
    ("Range",      "#60a5fa", "setup"),
    ("Trending",   "#fbbf24", "condition"),
    ("Choppy",     "#94a3b8", "condition"),
    ("FOMO",       "#fb7185", "mistake"),
    ("Early entry","#fb7185", "mistake"),
]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def random_session_time(days_ago_max=45):
    """A datetime within the last N days, on a weekday, between 9:30 and 16:00 ET."""
    while True:
        days = random.randint(0, days_ago_max)
        d = datetime.now(timezone.utc) - timedelta(days=days)
        if d.weekday() >= 5:  # Sat/Sun
            continue
        # ET market hours, very rough — we just need plausible times
        hour = random.randint(13, 19)  # 9:30 ET ≈ 13:30 UTC, 16:00 ET ≈ 20:00 UTC
        minute = random.randint(0, 59)
        return d.replace(hour=hour, minute=minute, second=0, microsecond=0)


def round_to_tick(value, tick_size):
    return round(value / tick_size) * tick_size


def make_trade(account_id, force_open=False):
    sym = random.choice(SYMBOLS)
    spec = INSTRUMENTS[sym]
    pv = spec["point_value"]
    base = spec["base"] + random.uniform(-spec["vol"] * 4, spec["vol"] * 4)
    direction = random.choice(["long", "short"])
    contracts = random.choice([1, 1, 1, 2, 2, 3])

    # Stop distance in points sized so the dollar risk is plausible for a 50k account
    risk_dollars_target = random.uniform(50, 150)
    stop_points = max(0.25, risk_dollars_target / (pv * contracts))
    rr_target = random.choice([1.5, 2.0, 2.0, 2.5, 3.0])

    if direction == "long":
        entry = round(base, 2)
        stop = round(entry - stop_points, 2)
        target = round(entry + stop_points * rr_target, 2)
    else:
        entry = round(base, 2)
        stop = round(entry + stop_points, 2)
        target = round(entry - stop_points * rr_target, 2)

    entry_time = random_session_time()

    if force_open:
        return {
            "account_id": account_id,
            "instrument": sym,
            "direction": direction,
            "entry_time": entry_time.isoformat(),
            "entry_price": entry,
            "stop_price": stop,
            "target_price": target,
            "contracts": contracts,
            "exit_time": None,
            "exit_price": None,
            "fees": 0.0,
            "pnl_points": None,
            "pnl_dollars": None,
            "r_multiple": None,
            "status": "open",
            "confidence": random.randint(2, 5),
            "notes": None,
            "plan_id": None,
        }

    # Outcome distribution: 55% target hit, 30% stop hit, 15% partial
    outcome_roll = random.random()
    if outcome_roll < 0.55:
        # full target win
        exit_price = target
        r = rr_target
    elif outcome_roll < 0.85:
        # stop hit
        exit_price = stop
        r = -1.0
    else:
        # partial — somewhere between -0.5R and +1.5R
        r = random.uniform(-0.5, 1.5)
        if direction == "long":
            exit_price = round(entry + (stop_points * r), 2)
        else:
            exit_price = round(entry - (stop_points * r), 2)

    pnl_points = (exit_price - entry) if direction == "long" else (entry - exit_price)
    fees = round(random.uniform(0.5, 2.0) * contracts, 2)
    pnl_dollars = round(pnl_points * pv * contracts - fees, 2)
    risk_points = abs(entry - stop)
    r_multiple = round(pnl_points / risk_points, 4) if risk_points > 0 else None

    hold_minutes = random.randint(3, 240)
    exit_time = entry_time + timedelta(minutes=hold_minutes)

    return {
        "account_id": account_id,
        "instrument": sym,
        "direction": direction,
        "entry_time": entry_time.isoformat(),
        "entry_price": entry,
        "stop_price": stop,
        "target_price": target,
        "contracts": contracts,
        "exit_time": exit_time.isoformat(),
        "exit_price": round(exit_price, 2),
        "fees": fees,
        "pnl_points": round(pnl_points, 4),
        "pnl_dollars": pnl_dollars,
        "r_multiple": r_multiple,
        "status": "closed",
        "confidence": random.randint(2, 5),
        "notes": None,
        "plan_id": None,
    }


def make_plan(account_id):
    sym = random.choice(SYMBOLS)
    spec = INSTRUMENTS[sym]
    pv = spec["point_value"]
    base = spec["base"] + random.uniform(-spec["vol"] * 3, spec["vol"] * 3)
    direction = random.choice(["long", "short"])
    contracts = random.choice([1, 2])
    stop_points = random.uniform(50, 150) / (pv * contracts)
    rr = random.choice([1.5, 2.0, 2.5, 3.0])
    if direction == "long":
        entry = round(base, 2)
        stop = round(entry - stop_points, 2)
        target = round(entry + stop_points * rr, 2)
    else:
        entry = round(base, 2)
        stop = round(entry + stop_points, 2)
        target = round(entry - stop_points * rr, 2)
    return {
        "account_id": account_id,
        "instrument": sym,
        "direction": direction,
        "entry_price": entry,
        "stop_price": stop,
        "target_price": target,
        "contracts": contracts,
        "rr_planned": rr,
        "thesis": random.choice(
            [
                "Trend day setup, looking for continuation off VWAP reclaim.",
                "Reversion back into balance after rejected high.",
                "ORB break with confluence at prior session POC.",
                "Failed breakdown, sweep of liquidity then recovery.",
                "Range top fade into supply.",
            ]
        ),
        "status": "active",
    }


def main():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return

    random.seed(42)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # ----- account -----
    row = cur.execute(
        "SELECT id, name FROM accounts WHERE is_active = 1 ORDER BY id LIMIT 1"
    ).fetchone()
    if not row:
        print("No active account. Create one in the app first.")
        return
    account_id, account_name = row
    print(f"Seeding into account {account_id}: {account_name}")

    # ----- tags -----
    existing_tags = cur.execute("SELECT COUNT(*) FROM tags").fetchone()[0]
    if existing_tags == 0:
        for name, color, category in TAGS:
            cur.execute(
                "INSERT INTO tags (name, color, category) VALUES (?, ?, ?)",
                (name, color, category),
            )
        print(f"Inserted {len(TAGS)} tags")
    tag_ids = [r[0] for r in cur.execute("SELECT id FROM tags").fetchall()]

    # ----- trades -----
    closed_trades = [make_trade(account_id) for _ in range(45)]
    open_trades = [make_trade(account_id, force_open=True) for _ in range(3)]
    all_trades = closed_trades + open_trades

    inserted_trade_ids = []
    for t in all_trades:
        now = now_iso()
        cur.execute(
            """INSERT INTO trades (
              account_id, instrument, direction, entry_time, entry_price,
              stop_price, target_price, contracts, exit_time, exit_price, fees,
              pnl_points, pnl_dollars, r_multiple, status, confidence, notes,
              plan_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                t["account_id"],
                t["instrument"],
                t["direction"],
                t["entry_time"],
                t["entry_price"],
                t["stop_price"],
                t["target_price"],
                t["contracts"],
                t["exit_time"],
                t["exit_price"],
                t["fees"],
                t["pnl_points"],
                t["pnl_dollars"],
                t["r_multiple"],
                t["status"],
                t["confidence"],
                t["notes"],
                t["plan_id"],
                now,
                now,
            ),
        )
        inserted_trade_ids.append(cur.lastrowid)
    print(f"Inserted {len(all_trades)} trades ({len(closed_trades)} closed, {len(open_trades)} open)")

    # ----- trade_tags: 0-2 random tags per trade -----
    for tid in inserted_trade_ids:
        n = random.choice([0, 1, 1, 2, 2])
        for tag_id in random.sample(tag_ids, min(n, len(tag_ids))):
            try:
                cur.execute(
                    "INSERT INTO trade_tags (trade_id, tag_id) VALUES (?, ?)",
                    (tid, tag_id),
                )
            except sqlite3.IntegrityError:
                pass

    # ----- plans -----
    plans = [make_plan(account_id) for _ in range(5)]
    for p in plans:
        now = now_iso()
        cur.execute(
            """INSERT INTO plans (
              account_id, instrument, direction, entry_price, stop_price,
              target_price, contracts, rr_planned, thesis, status,
              trade_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)""",
            (
                p["account_id"],
                p["instrument"],
                p["direction"],
                p["entry_price"],
                p["stop_price"],
                p["target_price"],
                p["contracts"],
                p["rr_planned"],
                p["thesis"],
                p["status"],
                now,
                now,
            ),
        )
    # Mark one as invalidated for variety
    cur.execute(
        "UPDATE plans SET status = 'invalidated' WHERE id = (SELECT MIN(id) FROM plans WHERE status='active')"
    )
    print(f"Inserted {len(plans)} plans")

    # ----- recompute account current_balance -----
    pnl_total = cur.execute(
        "SELECT COALESCE(SUM(pnl_dollars), 0) FROM trades WHERE account_id = ? AND status = 'closed'",
        (account_id,),
    ).fetchone()[0]
    tx_total = 0  # no synthetic transactions; balance = size + closed pnl
    starting = cur.execute(
        "SELECT account_size FROM accounts WHERE id = ?", (account_id,)
    ).fetchone()[0]
    new_balance = starting + tx_total + pnl_total
    cur.execute(
        "UPDATE accounts SET current_balance = ? WHERE id = ?",
        (new_balance, account_id),
    )
    print(f"Recomputed balance: starting ${starting:,.2f} + pnl ${pnl_total:,.2f} = ${new_balance:,.2f}")

    conn.commit()
    conn.close()
    print("\nDone. Refresh the app window to see the data.")


if __name__ == "__main__":
    main()
