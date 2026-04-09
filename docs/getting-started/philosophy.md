# Philosophy

Futures Journal makes a dozen opinionated choices about how a futures trader should keep a journal, and if you fight them you'll lose. This page tells you what they are and why.

Every journal is opinionated whether it admits it or not — the defaults, the fields, the metrics
shown on the dashboard. This one is opinionated on purpose, out loud, and the constraints are the
point. If the model fits how you trade, the app gets out of your way. If it doesn't, no amount of
configuration will make it comfortable. Read this before you get deep enough into the app to be
annoyed.

---

## Futures only

No stocks, no options, no crypto, no forex. The math, the validators, the analytics, and the risk
engine all assume `point_value × contracts` P&L. Percentage moves and share counts don't appear
anywhere because they don't mean anything in this context.

If you want to journal a stock swing alongside your MES trades, this isn't the tool. The whole
mental model collapses the moment it has to handle two different P&L formulas.

## Stops required on every trade

The trade form will not let you save a trade without a stop price. An entry with no stop isn't a
trade — it's a mistake you got away with, or didn't. Since R-multiples and risk are both computed
from stop distance, and since the risk engine needs to know what "if this trade goes wrong" means
before it can warn you, a missing stop breaks the entire downstream model.

If you use a mental stop or a time stop, use the **risk override** field to enter the dollar risk
manually. The form accepts that. What it refuses is silence.

## R-multiples are the primary metric

R — profit or loss divided by initial risk — is how the analytics page ranks trades, reports
expectancy, and builds the distribution chart. Dollar P&L is always shown, but it's not what the
app optimizes for. A +2R loss day on a combine and a +2R win day on a sim-funded account are the
same fact about your trading, even though the dollar amounts are different.

Read [R-multiples](../concepts/r-multiples.md) for the full reasoning.

## No percentage P&L

You will not see "up 2.4% today" anywhere. A 2% day on a $50k funded account means nothing — one
tick on ZB is $31.25 and one tick on MES is $1.25. Percent of account size is a stock-trader
metric, and dragging it into futures produces numbers that look meaningful and aren't.

Dollars and R. That's the vocabulary.

## Plans need both stop AND target

The plans form requires an entry, a stop, *and* a target. If you can't pick a target price, you
don't have a plan — you have a directional bias and a hope. The `plans.target_price` column is
`NOT NULL` at the schema level, so this is enforced below the UI as well.

When you "take" a plan, the app pre-fills a new trade from it and links the two rows so analytics
can tell you whether your planned trades perform differently from your unplanned ones. They almost
always do, and the delta is almost always educational.

## Firm rules live on the account, not in code

Apex, Topstep, Tradeify, MFFU, Bulenox, Take Profit Trader — they all change their rules every few
months. Rather than hardcoding `if (firm === 'Apex')` branches that rot immediately, the app models
rule *mechanisms* (drawdown mode, lock offset, daily loss limit, contract caps, consistency
percentage) as generic per-account fields. You configure them once per account using whatever
the firm's current rules are, and the risk engine applies them generically.

This means you are responsible for getting the rules right when you create the account. It also
means when your firm changes their drawdown from $2,500 to $3,000, you update one field and
everything keeps working. No waiting for a code release.

## Two ledgers, parallel

The app tracks two separate views of your money and never mixes them. The **sim ledger** is P&L on
combine, sim-funded, and live-funded accounts — fake money that exists to qualify against firm
rules. The **real ledger** is your actual net worth: cash brokerages, your personal bank, payouts
received, and all the fees you've paid to prop firms.

They answer different questions. The sim ledger tells you whether you're trading well enough to
pass combines and earn payouts. The real ledger tells you whether the ecosystem is actually paying
you for it. Both matter. Conflating them is what makes new prop traders feel rich when they're
actually down for the year.

Read [The two ledgers](../concepts/the-two-ledgers.md) — it's the single most important concept in
the app.

## Failed combines archive, not delete

When a combine fails — you hit the drawdown, busted the daily loss, whatever — don't delete the
account. Archive it. The trade history stays, the review notes stay, the risk overrides you
recorded stay, and you can flip the "include archived" toggle on the analytics page whenever you
want to see what went wrong across all your attempts. Pretending a failed combine didn't happen is
how you run the same mistake three more times.

## Local-first, no telemetry

Your entire database is a single SQLite file on your own disk. There's no cloud, no account to
create, no sync, no "anonymous usage statistics," no crash reporter phoning home. The Rust backend
exposes eight custom commands total, all of which read or write files inside your own app-data
directory and nothing else. You can unplug the machine and the app still works perfectly.

This also means you're responsible for your own backups, which is why the app writes an automatic
daily backup to `<app_data>/backups/` on launch and keeps the 14 most recent copies.

## Safety UI maximizes visibility

The dashboard's Today panel shows **every active account**, regardless of which rule columns are
set. Cards adapt to what's configured — if you haven't set a daily loss limit, that bar is hidden,
but the card is still there. The rule the app follows is: don't filter an account out of safety UI
just because one field is blank. You should always see the full picture of what's live.

Archived accounts are hidden by default (with an opt-in toggle), because their purpose is
historical review, not daily operations.

---

## If this feels wrong

If two or three of these choices feel wrong for how you trade, this is probably not the right
journal for you. That's fine. There are many journals, and the good ones are all opinionated in
different directions. The ones that try to be everything to everyone end up being a spreadsheet
with a skin.

If the choices feel right, stop reading and go start logging trades. The rest of the knowledge base
is here when you need it.

---

## Related reading

- [The two ledgers](../concepts/the-two-ledgers.md) — the foundational money model
- [Accounts and categories](../concepts/accounts-and-categories.md) — the five account types and when each applies
- [Plans and trades](../concepts/plans-and-trades.md) — the plan → trade → review loop
- [R-multiples](../concepts/r-multiples.md) — why R beats dollars and why percentages are absent
- [The risk engine](../concepts/the-risk-engine.md) — what the pre-trade risk check does and how overrides are recorded
