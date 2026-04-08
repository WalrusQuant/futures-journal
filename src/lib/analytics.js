// Pure aggregation over a list of trade rows. No DB calls.
// Inputs are trade objects shaped like the rows returned by lib/trades.listTrades.

export function summarizeTrades(trades) {
  const closed = trades.filter(
    (t) => t.status === "closed" && t.pnl_dollars != null
  );
  const n = closed.length;
  if (n === 0) {
    return {
      count: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      profitFactor: 0,
      avgR: 0,
      expectancy: 0,
      totalPnL: 0,
      grossWin: 0,
      grossLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgWin: 0,
      avgLoss: 0,
      avgHoldHours: 0,
    };
  }

  const wins = closed.filter((t) => t.pnl_dollars > 0);
  const losses = closed.filter((t) => t.pnl_dollars < 0);
  const breakevens = closed.filter((t) => t.pnl_dollars === 0);

  const totalPnL = sum(closed.map((t) => t.pnl_dollars));
  const grossWin = sum(wins.map((t) => t.pnl_dollars));
  const grossLoss = Math.abs(sum(losses.map((t) => t.pnl_dollars)));

  const winRate = (wins.length / n) * 100;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const profitFactor =
    grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  const rValues = closed
    .map((t) => t.r_multiple)
    .filter((r) => r != null && Number.isFinite(r));
  const avgR = rValues.length ? sum(rValues) / rValues.length : 0;

  // Expectancy: per-trade expected $ given current win rate, avg win, avg loss.
  const wr = winRate / 100;
  const expectancy = wr * avgWin - (1 - wr) * avgLoss;

  const pnls = closed.map((t) => t.pnl_dollars);
  const bestTrade = Math.max(...pnls);
  const worstTrade = Math.min(...pnls);

  const holds = closed
    .filter((t) => t.entry_time && t.exit_time)
    .map(
      (t) =>
        (new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) /
        3600000
    );
  const avgHoldHours = holds.length ? sum(holds) / holds.length : 0;

  return {
    count: n,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRate,
    profitFactor,
    avgR,
    expectancy,
    totalPnL,
    grossWin,
    grossLoss,
    bestTrade,
    worstTrade,
    avgWin,
    avgLoss,
    avgHoldHours,
  };
}

// Cumulative P&L curve, ordered by exit_time. Starts at 0.
export function equityCurve(trades) {
  const closed = trades
    .filter((t) => t.status === "closed" && t.exit_time && t.pnl_dollars != null)
    .slice()
    .sort((a, b) => a.exit_time.localeCompare(b.exit_time));
  let cum = 0;
  const points = [{ x: 0, y: 0, label: "start" }];
  closed.forEach((t, i) => {
    cum += t.pnl_dollars;
    points.push({ x: i + 1, y: cum, label: t.exit_time });
  });
  return points;
}

// Consistency rule evaluator. Takes closed trades (all of them, since the
// rule applies over the account's lifetime) and a percentage threshold
// 0–100 (e.g. 30 = "best day may not exceed 30% of total profit").
//
// Returns null when there's nothing meaningful to report yet — an account
// with no net profit or no profitable days at all isn't breaching
// anything. Otherwise returns:
//   {
//     bestDay:    dollars on the single best day,
//     bestDayKey: YYYY-MM-DD of that day,
//     totalPnl:   sum across all closed trades,
//     ratio:      bestDay / totalPnl (0..1),
//     limit:      pct / 100,
//     breach:     true if ratio > limit,
//   }
//
// Display-only — the consistency rule can't meaningfully block
// individual trades since it's evaluated end-of-day against cumulative
// profit, so callers render this as a tone-coded stat, not a blocker.
export function consistencyStatus(trades, pct) {
  if (pct == null) return null;
  const byDay = groupByDay(trades);
  let bestDay = 0;
  let bestDayKey = null;
  let total = 0;
  for (const [key, d] of byDay) {
    total += d.pnl;
    if (d.pnl > bestDay) {
      bestDay = d.pnl;
      bestDayKey = key;
    }
  }
  if (total <= 0 || bestDay <= 0) return null;
  const ratio = bestDay / total;
  const limit = pct / 100;
  return {
    bestDay,
    bestDayKey,
    totalPnl: total,
    ratio,
    limit,
    breach: ratio > limit,
  };
}

// Map of YYYY-MM-DD (local date) -> { pnl, count, wins, losses }
export function groupByDay(trades) {
  const map = new Map();
  for (const t of trades) {
    if (t.status !== "closed" || !t.exit_time || t.pnl_dollars == null)
      continue;
    const key = localDateKey(t.exit_time);
    const cur = map.get(key) || { pnl: 0, count: 0, wins: 0, losses: 0 };
    cur.pnl += t.pnl_dollars;
    cur.count += 1;
    if (t.pnl_dollars > 0) cur.wins += 1;
    else if (t.pnl_dollars < 0) cur.losses += 1;
    map.set(key, cur);
  }
  return map;
}

export function groupByInstrument(trades) {
  const map = new Map();
  for (const t of trades) {
    if (t.status !== "closed" || t.pnl_dollars == null) continue;
    const cur = map.get(t.instrument) || { pnl: 0, count: 0, wins: 0 };
    cur.pnl += t.pnl_dollars;
    cur.count += 1;
    if (t.pnl_dollars > 0) cur.wins += 1;
    map.set(t.instrument, cur);
  }
  return Array.from(map.entries())
    .map(([instrument, v]) => ({
      instrument,
      ...v,
      winRate: v.count ? (v.wins / v.count) * 100 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

// Tag breakdown reads tag_names from the joined SELECT (pipe-delimited string).
// Each row includes expectancy and avg R so tag-level edge is visible.
export function groupByTag(trades) {
  const map = new Map();
  for (const t of trades) {
    if (t.status !== "closed" || t.pnl_dollars == null) continue;
    if (!t.tag_names) continue;
    const names = t.tag_names.split("|");
    const colors = (t.tag_colors || "").split("|");
    names.forEach((name, i) => {
      const key = name;
      const cur = map.get(key) || {
        name,
        color: colors[i] || "#94a3b8",
        pnl: 0,
        count: 0,
        wins: 0,
        losses: 0,
        grossWin: 0,
        grossLoss: 0,
        rSum: 0,
        rCount: 0,
      };
      cur.pnl += t.pnl_dollars;
      cur.count += 1;
      if (t.pnl_dollars > 0) {
        cur.wins += 1;
        cur.grossWin += t.pnl_dollars;
      } else if (t.pnl_dollars < 0) {
        cur.losses += 1;
        cur.grossLoss += Math.abs(t.pnl_dollars);
      }
      if (t.r_multiple != null && Number.isFinite(t.r_multiple)) {
        cur.rSum += t.r_multiple;
        cur.rCount += 1;
      }
      map.set(key, cur);
    });
  }
  return Array.from(map.values())
    .map((v) => {
      const winRate = v.count ? (v.wins / v.count) * 100 : 0;
      const avgWin = v.wins ? v.grossWin / v.wins : 0;
      const avgLoss = v.losses ? v.grossLoss / v.losses : 0;
      const wr = winRate / 100;
      const expectancy = wr * avgWin - (1 - wr) * avgLoss;
      const avgR = v.rCount ? v.rSum / v.rCount : 0;
      return { ...v, winRate, expectancy, avgR };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

// Per-account breakdown (same shape as groupByInstrument). Requires the
// joined SELECT to include `account_name` — listTrades already does.
export function groupByAccount(trades) {
  const map = new Map();
  for (const t of trades) {
    if (t.status !== "closed" || t.pnl_dollars == null) continue;
    const key = t.account_id;
    const cur = map.get(key) || {
      account_id: t.account_id,
      account_name: t.account_name || `#${t.account_id}`,
      pnl: 0,
      count: 0,
      wins: 0,
    };
    cur.pnl += t.pnl_dollars;
    cur.count += 1;
    if (t.pnl_dollars > 0) cur.wins += 1;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, winRate: v.count ? (v.wins / v.count) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

// Bucket by hour-of-day of entry_time (0–23). Returns a fixed 24-item array
// so the bar chart has a stable x-axis even if some hours have no trades.
export function groupByHourOfDay(trades) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: String(h).padStart(2, "0"),
    pnl: 0,
    count: 0,
    wins: 0,
  }));
  for (const t of trades) {
    if (t.status !== "closed" || t.pnl_dollars == null || !t.entry_time)
      continue;
    const h = new Date(t.entry_time).getHours();
    const b = buckets[h];
    b.pnl += t.pnl_dollars;
    b.count += 1;
    if (t.pnl_dollars > 0) b.wins += 1;
  }
  return buckets.map((b) => ({
    ...b,
    winRate: b.count ? (b.wins / b.count) * 100 : 0,
  }));
}

// Bucket by day-of-week of entry_time (Mon–Fri only — futures don't trade
// weekends, so Sat/Sun buckets would just be noise).
export function groupByDayOfWeek(trades) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const buckets = [1, 2, 3, 4, 5].map((d) => ({
    day: d,
    label: names[d],
    pnl: 0,
    count: 0,
    wins: 0,
  }));
  const byIdx = new Map(buckets.map((b) => [b.day, b]));
  for (const t of trades) {
    if (t.status !== "closed" || t.pnl_dollars == null || !t.entry_time)
      continue;
    const d = new Date(t.entry_time).getDay();
    const b = byIdx.get(d);
    if (!b) continue; // weekend — skip
    b.pnl += t.pnl_dollars;
    b.count += 1;
    if (t.pnl_dollars > 0) b.wins += 1;
  }
  return buckets.map((b) => ({
    ...b,
    winRate: b.count ? (b.wins / b.count) * 100 : 0,
  }));
}

// Win/loss streak tracking. Order-sensitive: walks closed trades by
// exit_time and tracks the current run and the longest seen so far.
// Breakeven trades are treated as neutral and break any streak.
export function computeStreaks(trades) {
  const closed = trades
    .filter((t) => t.status === "closed" && t.pnl_dollars != null && t.exit_time)
    .slice()
    .sort((a, b) => a.exit_time.localeCompare(b.exit_time));

  let longestWin = 0;
  let longestLoss = 0;
  let currentDir = null; // "win" | "loss" | null
  let currentLen = 0;

  for (const t of closed) {
    const outcome =
      t.pnl_dollars > 0 ? "win" : t.pnl_dollars < 0 ? "loss" : null;
    if (outcome == null) {
      currentDir = null;
      currentLen = 0;
      continue;
    }
    if (outcome === currentDir) {
      currentLen += 1;
    } else {
      currentDir = outcome;
      currentLen = 1;
    }
    if (outcome === "win" && currentLen > longestWin) longestWin = currentLen;
    if (outcome === "loss" && currentLen > longestLoss)
      longestLoss = currentLen;
  }

  return {
    longestWin,
    longestLoss,
    currentDirection: currentDir,
    currentLength: currentLen,
  };
}

// Review coverage: what % of closed trades have review_completed = 1.
// Unreviewable (open) trades aren't counted in the denominator.
export function reviewCoverage(trades) {
  const closed = trades.filter((t) => t.status === "closed");
  const reviewed = closed.filter((t) => t.review_completed);
  return {
    total: closed.length,
    reviewed: reviewed.length,
    pct: closed.length ? (reviewed.length / closed.length) * 100 : 0,
  };
}

// Split trades into planned vs unplanned buckets and run the full summary
// on each. "Planned" means the trade has a plan_id — i.e. it was taken from
// a plan via the "Take plan" flow. Returns { planned, unplanned } where
// each value is the same shape as summarizeTrades().
export function groupByPlannedStatus(trades) {
  const planned = [];
  const unplanned = [];
  for (const t of trades) {
    if (t.plan_id != null) planned.push(t);
    else unplanned.push(t);
  }
  return {
    planned: summarizeTrades(planned),
    unplanned: summarizeTrades(unplanned),
  };
}

// Bin R-multiples for a histogram. Buckets: <-2, -2..-1, -1..0, 0..1, 1..2, 2..3, >3
export function rDistribution(trades) {
  const buckets = [
    { label: "< -2R", min: -Infinity, max: -2, count: 0 },
    { label: "-2..-1", min: -2, max: -1, count: 0 },
    { label: "-1..0", min: -1, max: 0, count: 0 },
    { label: "0..1", min: 0, max: 1, count: 0 },
    { label: "1..2", min: 1, max: 2, count: 0 },
    { label: "2..3", min: 2, max: 3, count: 0 },
    { label: "> 3R", min: 3, max: Infinity, count: 0 },
  ];
  for (const t of trades) {
    if (t.r_multiple == null || !Number.isFinite(t.r_multiple)) continue;
    for (const b of buckets) {
      if (t.r_multiple >= b.min && t.r_multiple < b.max) {
        b.count += 1;
        break;
      }
    }
  }
  return buckets;
}

// ---------- helpers ----------

export function localDateKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Week starts on `weekStart` (0=Sunday, 1=Monday). Defaults to Sunday.
export function weekBounds(date = new Date(), weekStart = 0) {
  const start = new Date(date);
  const day = start.getDay();
  const offset = (day - weekStart + 7) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { start, end };
}

function sum(arr) {
  let s = 0;
  for (const x of arr) s += x;
  return s;
}
