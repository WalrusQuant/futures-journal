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
      };
      cur.pnl += t.pnl_dollars;
      cur.count += 1;
      if (t.pnl_dollars > 0) cur.wins += 1;
      map.set(key, cur);
    });
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, winRate: v.count ? (v.wins / v.count) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
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
