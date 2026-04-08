// Real-money ledger computation.
//
// The app has two parallel ledgers:
//
//   1. Sim ledger — combines and sim-funded accounts. Trade P&L here is
//      simulated. The user isn't actually making or losing money from
//      those trades; they're performing against firm rules to qualify
//      for payouts.
//
//   2. Real ledger — the user's actual net worth from this trading
//      activity. Cash brokerages and the personal bank live here, plus
//      any crossings from the sim world (payouts received from funded
//      accounts, subscription/reset/activation fees paid to firms).
//
// This module computes the real-money ledger. It's pure — give it the
// accounts, closed trades, and transactions, and it returns a
// chronological event list, a running balance curve, and per-category
// totals. No DB access, no DOM.
//
// A closed trade on a cash account is real. A closed trade on a
// combine/sim-funded account is sim. A closed trade on a live-funded
// account is also sim until the user withdraws it (per explicit user
// decision: live-funded P&L only materializes on the real ledger when
// paid out).
//
// Transactions:
//   deposit/withdrawal on cash or bank → external money in/out
//   payout on any funded account       → real inflow (sim → real bridge)
//   fee / reset / activation           → real outflow (user paid the firm)
//   transfer_out / transfer_in         → count only on the cash/bank side
//                                        to avoid double-counting; if the
//                                        counterparty is also real, the
//                                        pair is net zero and marked
//                                        'internal_transfer' for reports

// ---------- Category helpers ----------

export const REAL_CATEGORIES = new Set(["cash", "bank"]);
export const SIM_CATEGORIES = new Set([
  "combine",
  "sim_funded",
  "live_funded",
]);

export function isRealAccount(account) {
  return account ? REAL_CATEGORIES.has(account.category) : false;
}

export function isFundedAccount(account) {
  return account ? SIM_CATEGORIES.has(account.category) : false;
}

// ---------- Ledger computation ----------

// Returns:
//   {
//     events: [{ t, delta, kind, category, account, counterparty?, tx?, trade? }],
//     curve:  [{ t, balance }],
//     totals: { external_in, external_out, payout_received, sub_fee,
//               reset_fee, activation_fee, cash_trade, internal_transfer,
//               net },
//     running: final real-money net (= curve[last].balance)
//   }
//
// `totals.net` excludes `internal_transfer` events because a bank↔cash
// transfer is net zero to your real worth — it's just moving real money
// between two real buckets.
export function realMoneyLedger(accounts, trades, transactions) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const txById = new Map(transactions.map((t) => [t.id, t]));

  const events = [];

  for (const tx of transactions) {
    const acct = byId.get(tx.account_id);
    if (!acct) continue;

    switch (tx.type) {
      case "deposit": {
        if (!isRealAccount(acct)) break;
        events.push({
          t: tx.occurred_at,
          delta: +tx.amount,
          kind: "deposit",
          category: "external_in",
          account: acct,
          tx,
        });
        break;
      }
      case "withdrawal": {
        if (!isRealAccount(acct)) break;
        events.push({
          t: tx.occurred_at,
          delta: -tx.amount,
          kind: "withdrawal",
          category: "external_out",
          account: acct,
          tx,
        });
        break;
      }
      case "payout": {
        // A manual payout logged on a funded account is the sim → real
        // bridge. Count it as a real inflow. If the user instead used
        // the transfer helper (transfer_out on funded + transfer_in on
        // bank), the transfer_in branch handles it below.
        if (!isFundedAccount(acct)) break;
        events.push({
          t: tx.occurred_at,
          delta: +tx.amount,
          kind: "payout",
          category: "payout_received",
          account: acct,
          tx,
        });
        break;
      }
      case "fee":
      case "reset":
      case "activation": {
        // All three are real money paid to the firm. Category differs
        // so reports can break them out (monthly subs vs resets vs
        // one-time activation).
        const category =
          tx.type === "fee"
            ? "sub_fee"
            : tx.type === "reset"
            ? "reset_fee"
            : "activation_fee";
        events.push({
          t: tx.occurred_at,
          delta: -tx.amount,
          kind: tx.type,
          category,
          account: acct,
          paidFor:
            tx.paid_for_account_id != null
              ? byId.get(tx.paid_for_account_id) || null
              : null,
          tx,
        });
        break;
      }
      case "transfer_out":
      case "transfer_in": {
        // Count each transfer only on its real side. The counterparty
        // classifies the event:
        //   real <-> real  → internal (net zero across the real ledger)
        //   funded -> real → inflow (same as a payout_received)
        //   real   -> funded (rare) → outflow (same as funding a combine,
        //                                      though normally you'd use a fee)
        if (!isRealAccount(acct)) break;
        const other = tx.linked_tx_id ? txById.get(tx.linked_tx_id) : null;
        const otherAcct = other ? byId.get(other.account_id) : null;
        const bothReal = isRealAccount(otherAcct);
        let category;
        if (bothReal) {
          category = "internal_transfer";
        } else if (tx.type === "transfer_in") {
          category = "payout_received";
        } else {
          category = "external_out";
        }
        const sign = tx.type === "transfer_in" ? +1 : -1;
        events.push({
          t: tx.occurred_at,
          delta: sign * tx.amount,
          kind: tx.type,
          category,
          account: acct,
          counterparty: otherAcct || null,
          tx,
        });
        break;
      }
      default:
        break;
    }
  }

  // Cash-account trades are real money. Funded-account trades (combine,
  // sim_funded, live_funded) are sim and excluded — live-funded P&L only
  // enters the real ledger when withdrawn (as a payout/transfer).
  for (const t of trades) {
    if (t.status !== "closed") continue;
    if (!t.exit_time || t.pnl_dollars == null) continue;
    const acct = byId.get(t.account_id);
    if (!acct || acct.category !== "cash") continue;
    events.push({
      t: t.exit_time,
      delta: t.pnl_dollars,
      kind: "trade",
      category: "cash_trade",
      account: acct,
      trade: t,
    });
  }

  events.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));

  const totals = {
    external_in: 0,
    external_out: 0,
    payout_received: 0,
    sub_fee: 0,
    reset_fee: 0,
    activation_fee: 0,
    cash_trade: 0,
    internal_transfer: 0,
    net: 0,
  };
  let running = 0;
  const curve = [];
  for (const e of events) {
    running += e.delta;
    curve.push({ t: e.t, balance: running });
    totals[e.category] = (totals[e.category] || 0) + e.delta;
    // Internal real↔real transfers don't change net real worth.
    if (e.category !== "internal_transfer") {
      totals.net += e.delta;
    }
  }

  return { events, curve, totals, running };
}

// Filter a ledger result (or raw events) to a date window. Inclusive on
// both ends, ISO strings. Recomputes totals over just the filtered set.
export function filterLedgerByRange(ledger, startISO, endISO) {
  const events = ledger.events.filter(
    (e) => e.t >= startISO && e.t <= endISO
  );
  const totals = {
    external_in: 0,
    external_out: 0,
    payout_received: 0,
    sub_fee: 0,
    reset_fee: 0,
    activation_fee: 0,
    cash_trade: 0,
    internal_transfer: 0,
    net: 0,
  };
  let running = 0;
  const curve = [];
  for (const e of events) {
    running += e.delta;
    curve.push({ t: e.t, balance: running });
    totals[e.category] = (totals[e.category] || 0) + e.delta;
    if (e.category !== "internal_transfer") totals.net += e.delta;
  }
  return { events, curve, totals, running };
}

// Group ledger events by the funded account they pay for (via
// `paidFor`). Only fee/reset/activation events carry paidFor. Returns a
// Map<accountId, { account, totals: {sub_fee, reset_fee, activation_fee, total} }>.
// Unattributed fees go under key `null` with account=null.
export function feesByPaidForAccount(ledger) {
  const map = new Map();
  const ensure = (key, account) => {
    if (!map.has(key)) {
      map.set(key, {
        account,
        totals: { sub_fee: 0, reset_fee: 0, activation_fee: 0, total: 0 },
      });
    }
    return map.get(key);
  };
  for (const e of ledger.events) {
    if (
      e.category !== "sub_fee" &&
      e.category !== "reset_fee" &&
      e.category !== "activation_fee"
    ) {
      continue;
    }
    const key = e.paidFor ? e.paidFor.id : null;
    const bucket = ensure(key, e.paidFor || null);
    bucket.totals[e.category] += e.delta; // delta is already negative
    bucket.totals.total += e.delta;
  }
  return map;
}
