# Configuring prop firm rules

How to translate the rule sheet of your prop firm — Apex, Topstep, Tradeify, MFFU, or anyone else — into the
fields on the account form's Rules tab.

Futures Journal does not hardcode any firm's rules. It models the underlying mechanisms — trailing
drawdowns, lock offsets, daily loss limits, contract caps — and lets you combine them per account. That means
when your firm changes their rule sheet (and they will), you edit your account in the app instead of waiting
for a software update. It also means you're responsible for getting the mapping right once, up front. This
guide walks through the mapping, then shows a per-firm starting point for the big four combine providers.

If you haven't created the account yet, start with [Setting up your first account](setting-up-your-first-account.md)
and come back here for the Rules tab.

---

## The mechanism mapping

Every concept a prop firm will throw at you maps to exactly one field on the Rules tab. Learn this table once
and you can config any firm in five minutes.

| Firm rule concept | Form field | Notes |
|---|---|---|
| Trailing drawdown type (EOD vs intraday) | **Drawdown type** | `Static`, `End-of-day trailing`, `Intraday trailing`, or `No drawdown rule` |
| Max trailing drawdown dollars | **Drawdown amount** | The dollar distance from peak to floor. For an Apex 50k this is `2500`. |
| Floor locks at starting balance | **Lock floor at starting +** `0` | Typical combine rule — once your balance hits the starting balance, the floor stops trailing and parks there |
| Floor locks at starting + cushion | **Lock floor at starting +** `<cushion>` | Sim-funded accounts often lock `100` above starting as a safety buffer |
| Floor never locks | **Lock floor at starting +** empty | The trailing floor keeps moving with peak forever |
| Payout / withdrawal freezes the trailing floor | **Also lock on any withdrawal or payout** checkbox | Standard on sim-funded accounts after the first payout |
| Daily loss limit | **Daily loss limit** | Dollar amount. Leave empty if the firm has no DLL. |
| Profit target / pass threshold | **Profit target** | What you need to hit to pass the combine |
| Mini contract cap (ES, NQ, CL, etc.) | **Max minis** | Checked independently from micros |
| Micro contract cap (MES, MNQ, MCL, etc.) | **Max micros** | Checked independently from minis |
| Consistency rule ("best day ≤ N% of total") | **Consistency limit (%)** | Display-only. Not a pre-trade blocker. |
| Anything else (news, scaling, holding overnight) | **Rules notes** | Free-form textarea. The app won't enforce these, but it keeps them in front of you. |

The key invariant: **empty means not enforced**. If your firm has no daily loss limit, leave Daily loss limit
blank — don't type `0`, which would block every losing trade. The risk engine silently skips any check whose
field is empty. That's intentional.

---

## Apex Trader Funding

Apex is the simplest combine to model because the rules are mostly numeric. For an Apex 50k evaluation the
typical config looks like this:

- **Drawdown type**: `End-of-day trailing`
- **Drawdown amount**: `2500`
- **Lock floor at starting +**: `0` (floor locks at the starting balance once you reach it)
- **Also lock on any withdrawal or payout**: unchecked (combines don't take payouts)
- **Daily loss limit**: empty (Apex evaluations don't have a traditional DLL)
- **Profit target**: `3000`
- **Max minis**: `10`
- **Max micros**: `100`
- **Consistency limit (%)**: `30` if you want the end-of-day check; empty otherwise
- **Rules notes**: whatever the current rule sheet says about news holds, scaling, and minimum trading days

When the same account passes and becomes a PA (sim-funded), you should **create a new account** for the PA
rather than editing the combine. The two have different rules — the PA typically uses `Lock floor at starting
+ 100`, checks the payout-lock box, and the profit-target field becomes the payout threshold instead of a
pass threshold. Keeping them as separate rows also keeps your combine history intact for review.

Apex's rule sheet moves around. Before typing numbers, open your current Apex dashboard and read the exact
drawdown, target, and contract numbers for *your* plan size. What's above is a template, not canon.

---

## Topstep

Topstep is the other big one, and its mechanics are meaningfully different from Apex. For a Topstep 50k combine:

- **Drawdown type**: `End-of-day trailing`
- **Drawdown amount**: `2000`
- **Lock floor at starting +**: `0`
- **Also lock on any withdrawal or payout**: unchecked
- **Daily loss limit**: `1000`
- **Profit target**: `3000`
- **Max minis**: `5`
- **Max micros**: `50`
- **Consistency limit (%)**: empty (Topstep's consistency rule is phrased differently — track it in notes)
- **Rules notes**: Topstep's scaling plan and the minimum trading days rule

Note that Topstep has a real daily loss limit, unlike Apex. That means the risk engine's DLL blocker will
actually fire on a Topstep account, which is good — it's one of the most common ways people blow these. The
worst-case calc is: today realized + all open risk + this trade's risk. If that's under the limit, the trade
is blocked.

Topstep's funded accounts (Express Funded) typically use the payout-lock behavior once the first payout has
been taken, so check the "Also lock on any withdrawal or payout" box on those. Again, create a new account
row for the funded stage — don't mutate the combine row.

---

## Tradeify

Tradeify is a smaller firm but their rule shapes are firm-vanilla: trailing drawdown, contract caps, profit
target. For a Tradeify 50k Straight evaluation:

- **Drawdown type**: `End-of-day trailing`
- **Drawdown amount**: `2000`
- **Lock floor at starting +**: `0`
- **Also lock on any withdrawal or payout**: unchecked
- **Daily loss limit**: empty (not on the Straight account type)
- **Profit target**: `2000`
- **Max minis**: `5`
- **Max micros**: `50`
- **Rules notes**: reset and activation fee amounts, scaling plan

Tradeify's Advanced accounts add a daily loss limit. Model that by filling in the Daily loss limit field when
you create the account for the Advanced variant.

Tradeify funded accounts typically lock the drawdown floor at starting + 100 and freeze it on payout. That
means **Lock floor at starting +** = `100` and the payout-lock checkbox is on.

---

## My Funded Futures (MFFU)

MFFU sells two combine styles, a Starter and an Expert. For a Starter 50k:

- **Drawdown type**: `End-of-day trailing`
- **Drawdown amount**: `2000`
- **Lock floor at starting +**: `0`
- **Daily loss limit**: empty
- **Profit target**: `3000`
- **Max minis**: `5`
- **Max micros**: `50`
- **Rules notes**: scaling rules, consistency window, any news restrictions

For the Expert variant, the contract cap tightens and there's usually a daily loss limit — adjust accordingly.
MFFU's funded side uses the same lock-on-payout pattern as most other firms, so check the box and set the
lock offset when you create the funded account.

---

## Other firms

The same mapping works for any firm. Bulldog, Earn2Trade, TakeProfit, Uprofits, whoever. Read their rule
sheet with the mechanism table above open in another tab and fill each field. Three questions to ask the rule
sheet:

1. **What's the drawdown shape?** Static, EOD trailing, or intraday trailing? Pick one.
2. **How and when does the floor lock?** Never, at starting (offset `0`), at starting + cushion, or on payout?
3. **What are the hard caps?** Daily loss, contract count, profit target — fill each numeric field.

Anything the rule sheet mentions that doesn't fit one of the numeric fields — holding overnight, news events,
minimum trading days, scaling plans, flat-by-end-of-day requirements — goes in **Rules notes**. The app
doesn't enforce those, but the Rules notes field is visible on the account detail page so you'll see it
every time you open the account.

---

## When in doubt, leave it empty

Every field on the Rules tab is optional. An empty field means "no rule of this kind" and the risk engine
skips it silently. That's the preferred failure mode: rather than guess a value you're unsure of and get
blocked on a trade the firm wouldn't have blocked, leave it empty and add it later when you've read the rule
sheet again.

The single exception is **Drawdown type** — it defaults to `Static`, which is only correct for firms that
actually use a static drawdown. If you don't know your firm's drawdown model yet, switch it to `No drawdown
rule` so nothing fires, then update it once you do know.

Rules also change. When your firm updates their sheet, open the account, edit the Rules tab, save. The new
values take effect on the next trade you log.

---

## What this actually records

Saving the Rules tab writes to the `accounts` row: `drawdown_mode`, `trailing_dd`, `dd_lock_offset`,
`dd_lock_on_payout`, `daily_loss_limit`, `profit_target`, `max_minis`, `max_micros`, `consistency_pct`, and
`rules_notes`. The columns are all nullable — empty fields become `NULL`, and the risk engine's checks are
written as `if (column != null)` guards, so null columns are free. The values are read on every trade save
through `assessDraft()`, which passes them into `evaluateTradeRisk()` for the blocker/warning decisions. The
drawdown floor itself is recomputed on every call from the account's full closed-trade and transaction
history via `computeDrawdownFloor()`, so updating the Rules tab mid-combine is safe: the next trade will be
evaluated against the new floor immediately.

---

## Related reading

- [Drawdown modes](../concepts/drawdown-modes.md) — the math behind static, EOD, and intraday trailing
- [The risk engine](../concepts/the-risk-engine.md) — how the Rules tab translates into trade-time blockers
- [Accounts and categories](../concepts/accounts-and-categories.md) — why combine and funded stages are separate rows
- [Setting up your first account](setting-up-your-first-account.md) — the basics before the Rules tab
- [Archiving a failed combine](archiving-a-failed-combine.md) — what to do with the row when the combine dies
