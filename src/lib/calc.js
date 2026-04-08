// Pure futures math. No DOM, no DB. Inputs are plain objects.
//
// All P&L is computed in points and dollars (never percentage — meaningless
// for futures). R-multiple is points-based so it stays independent of fees
// and contract count.

export function tradePnL(trade, instrument) {
  if (
    trade.exit_price == null ||
    trade.entry_price == null ||
    !instrument
  )
    return null;
  const priceDiff =
    trade.direction === "long"
      ? trade.exit_price - trade.entry_price
      : trade.entry_price - trade.exit_price;
  const points = priceDiff;
  const dollars =
    points * instrument.point_value * trade.contracts - (trade.fees || 0);
  return { points, dollars };
}

export function tradeRisk(trade, instrument) {
  if (trade.stop_price == null || trade.entry_price == null || !instrument)
    return null;
  const riskPoints =
    trade.direction === "long"
      ? trade.entry_price - trade.stop_price
      : trade.stop_price - trade.entry_price;
  if (!Number.isFinite(riskPoints) || riskPoints <= 0) return null;
  const riskDollars = riskPoints * instrument.point_value * trade.contracts;
  return { points: riskPoints, dollars: riskDollars };
}

export function rMultiple(trade, instrument) {
  const pnl = tradePnL(trade, instrument);
  const risk = tradeRisk(trade, instrument);
  if (!pnl || !risk || risk.points <= 0) return null;
  return pnl.points / risk.points;
}

export function plannedRR(trade) {
  if (
    trade.entry_price == null ||
    trade.stop_price == null ||
    trade.target_price == null
  )
    return null;
  const risk =
    trade.direction === "long"
      ? trade.entry_price - trade.stop_price
      : trade.stop_price - trade.entry_price;
  const reward =
    trade.direction === "long"
      ? trade.target_price - trade.entry_price
      : trade.entry_price - trade.target_price;
  if (risk <= 0) return null;
  return reward / risk;
}

// Validation. Returns null if valid, otherwise an error message.
export function validateTradeShape(t) {
  if (!t.account_id) return "Account is required.";
  if (!t.instrument) return "Instrument is required.";
  if (!t.direction) return "Direction is required.";
  if (!Number.isFinite(t.entry_price) || t.entry_price <= 0)
    return "Entry price must be a positive number.";
  if (!Number.isFinite(t.stop_price) || t.stop_price <= 0)
    return "Stop price must be a positive number.";
  if (!Number.isInteger(t.contracts) || t.contracts < 1)
    return "Contracts must be a positive integer.";
  if (t.direction === "long" && t.stop_price >= t.entry_price)
    return "For a long trade, stop must be below entry.";
  if (t.direction === "short" && t.stop_price <= t.entry_price)
    return "For a short trade, stop must be above entry.";
  if (t.target_price != null) {
    if (t.direction === "long" && t.target_price <= t.entry_price)
      return "For a long trade, target must be above entry.";
    if (t.direction === "short" && t.target_price >= t.entry_price)
      return "For a short trade, target must be below entry.";
  }
  if (t.exit_price != null && !t.exit_time)
    return "Exit time is required when exit price is set.";
  if (t.exit_time && t.exit_price == null)
    return "Exit price is required when exit time is set.";
  return null;
}
