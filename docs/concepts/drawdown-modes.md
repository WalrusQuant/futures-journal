# Drawdown modes

Futures Journal models three drawdown calculation modes — static, end-of-day trailing, and intraday trailing — plus two lock triggers, and getting the configuration right on your funded accounts is what keeps the pre-trade risk engine from waving you into a rule violation.

Every prop firm enforces some flavor of drawdown rule, and the flavors differ enough that a single
generic "trailing drawdown" field isn't enough to model what actually happens in your account.
Apex doesn't count the same way Topstep does. Combine floors lock differently than sim-funded
floors. If the journal's model of the floor disagrees with the firm's model of the floor, every
other protection the app offers you — the pre-trade blockers, the headroom stat, the "within $750
of floor" dashboard warning — is off by the size of the disagreement, which is exactly when you
need it to be right.

This page walks through what each mode does, when to use it, how the two lock triggers interact,
and a worked example end-to-end. For the full source of truth, `computeDrawdownFloor()` in
`src/lib/accounts.js` is the canonical implementation.

---

## Why drawdown modeling is load-bearing

The drawdown floor is the balance level below which your account is dead. Hit it and the combine
fails, the sim-funded account freezes, or the live-funded account gets yanked. Every rule in the
app keys off this number: the headroom display ("$1,837 of drawdown room"), the risk engine's
floor-breach blocker ("stop-out would put the account below its drawdown floor"), the dashboard's
early-warning banner when you're within $750 of the floor.

If the floor the app computes matches the floor the firm computes, all of those protections work
as intended. If it doesn't, they silently lie to you. So configuring the drawdown fields on the
account correctly is the single most important setup step after choosing the category.

---

## The three modes

Set via the **Drawdown type** dropdown on the Rules tab.

### Static — the floor never moves

```
floor = account_size − drawdown_amount
```

The floor is fixed at the starting balance minus the drawdown, and it stays there forever. Peaks
don't matter. Withdrawals don't matter. Whatever your balance does, the floor is where it's been
since day one.

**When to use it.** Cash brokerage accounts where there's no trailing rule at all — leave this as
the default and don't set a drawdown amount. Also: a few firms run genuinely static drawdowns
where the rule is "you're done if the account hits X" and nothing about how you got there. Most
don't, so double-check before you pick this.

### End-of-day trailing — floor advances on session close

```
floor = peak(end-of-day balance) − drawdown_amount
```

The floor trails the highest **end-of-day** balance you've closed a session with. Intraday spikes
don't move the peak — the account can tag a high mid-session, give it back before the close, and
the peak doesn't register. Only the closing balance at session boundaries counts as a peak
candidate.

The practical effect is that this mode is more forgiving than intraday trailing. You can run up
$800 during the session, give back $500, close +$300, and only the +$300 advances the peak. If
the firm also locks at target (see below), reaching the lock threshold at close is what counts,
not touching it intraday.

**When to use it.** Apex-style combines and funded accounts. Most firms that advertise "trailing
drawdown" specifically mean this one. If you're not sure, assume end-of-day trailing — it's the
most common shape.

The app uses local-date bucketing to decide when the session rolls over, so the peak sampling
happens on date boundaries in your local timezone.

### Intraday trailing — floor advances on every closed trade

```
floor = peak(running balance after each closed trade) − drawdown_amount
```

The floor trails the highest running balance after every single closed trade. Every time you
close a trade, the app recomputes running balance and checks whether it's a new peak. If it is,
the peak advances and the floor drags up with it.

This is the strictest of the three modes because intraday spikes do count — the moment you close
a winner that sets a new high, the floor moves, whether or not you give some of it back before
the close. It's also the most honest approximation the app can make without tick data: the app
doesn't know your true intraday equity curve (no tick feed), but it does know where the balance
sat after every trade you closed, and that's the closest it can get.

**When to use it.** Topstep-style rules and any other firm where the marketing copy says
"intraday trailing" or "trailing from the highest point reached." If the firm's documentation
mentions touching a high intraday being what counts, this is the mode.

---

## The lock-at-target trigger

Once your peak reaches a certain threshold, the firm usually stops trailing and freezes the floor
at a specific level. This is what the **Lock floor at starting +** field on the Rules tab
configures. The mechanics are:

```
lock threshold = account_size + drawdown_amount + lock_offset
lock floor     = account_size + lock_offset
```

Once peak ≥ lock threshold, the floor is permanently frozen at `account_size + lock_offset` and
stops trailing, regardless of what the peak does afterward.

The help text under the field spells out the two common patterns:

- **Combine:** set the offset to **0**. Once your peak reaches `start + dd` (meaning you're
  "drawdown-free" — even a full drawdown wouldn't take you below your starting balance), the
  floor locks at the starting balance. This is the typical Apex combine rule.

- **Sim funded:** set the offset to **100**. Once your peak reaches `start + dd + $100`, the
  floor locks $100 above starting balance. This is the typical Apex PA / sim-funded behavior.

- **Leave blank** if the firm doesn't lock — the floor keeps trailing forever.

The lock is one-way. Once it trips, it stays tripped. The floor does not unlock if your balance
falls back below the threshold.

## The lock-on-payout trigger

The **Also lock on any withdrawal or payout** checkbox adds a second way for the lock to trip:
any `withdrawal` or `payout` transaction in the account's event stream locks the floor
immediately, regardless of where the peak is.

This models firms (most sim-funded setups) where the act of taking profit freezes the trailing
rule forever, because once you've pulled money out, the firm's exposure changes and they don't
want the trailing rule to keep giving you room. The lock floor uses the same `start + lock_offset`
formula as the lock-at-target trigger.

The two triggers are independent. Either one can fire first. Whichever fires first freezes the
floor.

---

## Worked example: an Apex 50k combine

Let's walk through a realistic session. The account:

- **Category:** Combine / Evaluation
- **Account size:** $50,000
- **Drawdown type:** End-of-day trailing
- **Drawdown amount:** $2,500
- **Lock floor at starting +:** 0 (combine style)
- **Also lock on payout:** unchecked (combines don't pay out)

Starting state: `start = 50,000`, `dd = 2,500`, `lock_offset = 0`, `lock_threshold = 52,500`,
`lock_floor = 50,000`.

**Day 1.** You close the day at **$50,800**. The end-of-day peak is now $50,800, so the floor
advances to `50,800 − 2,500 = $48,300`. Lock threshold not reached ($50,800 < $52,500).

**Day 2.** You have a bad session and close at **$50,200**. End-of-day peak stays at $50,800
(this day's close isn't a new high). Floor still at **$48,300**. Note that even though your
balance dropped, the floor didn't — trailing modes only move up.

**Day 3.** Great session, close at **$51,600**. New peak. Floor advances to
`51,600 − 2,500 = $49,100`. Lock threshold still not reached ($51,600 < $52,500).

**Day 4.** Huge session. You tag $52,900 intraday but give some back, closing at **$52,600**.
End-of-day peak is now $52,600, which is **above the $52,500 lock threshold**, so the floor
locks at `50,000 + 0 = $50,000` (the starting balance) and stops trailing.

From this point forward, the floor is **permanently $50,000**. If you later have a bad day and
close at $51,000, the floor is still $50,000. If you surge to $54,000, the floor is still $50,000.
The account is "drawdown-free" in the sense that you now have to fall back all the way to the
starting balance before the combine busts.

(Note that on day 4 the intraday tag of $52,900 would *also* have crossed the threshold, but
because we're in `eod_trailing` mode, the peak only updated at the close. In `intraday_trailing`
mode, the lock would have tripped the moment the $52,900 print advanced the running peak past
the threshold — because `intraday_trailing` updates the peak after every closed trade, not at
session boundaries. This is the exact difference between the two trailing modes, and why it
matters which one you pick.)

---

## A note on matching the firm's math exactly

Even with three modes and two lock triggers, there are firms and rules this model can't represent
perfectly — some firms measure peak balance on an hourly basis, some use a rolling-window
approach, some apply different drawdowns in different account stages. The app's model is
deliberately generic and covers the vast majority of real-world rules, but **you are responsible
for verifying that the floor the app computes matches the floor the firm reports.**

Compare the app's **Drawdown room** stat on the account detail page against the firm's dashboard
the first day you start trading the account, and again after a few sessions. If the numbers agree,
you're configured correctly. If they disagree, adjust the rule fields — usually the drawdown mode
or the lock offset — until they agree. The **Rules notes** free-text field on the Rules tab is
the right place to leave yourself a reminder about anything the form can't fully model.

---

## Related reading

- [Accounts and categories](accounts-and-categories.md) — which categories have drawdown rules and which don't
- [The risk engine](the-risk-engine.md) — how the computed floor becomes a pre-trade blocker
- [Configuring prop firm rules](../guides/configuring-prop-firm-rules.md) — per-firm walkthrough of the Rules tab fields
- [Setting up your first account](../guides/setting-up-your-first-account.md) — the typical combine setup end-to-end
