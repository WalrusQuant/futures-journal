# Futures Journal — Knowledge Base

The user-facing documentation for Futures Journal: how the app thinks, how to use it, and how to handle the real situations you'll run into as a futures trader working through prop firm combines and payouts.

If you're a developer looking for architecture, build commands, or migration notes, read [`../README.md`](../README.md) and [`../CLAUDE.md`](../CLAUDE.md) instead. This tree is for using the app, not building it.

---

## Start here

New to the app? Read these in order. Twenty minutes total.

1. [Install and first launch](getting-started/install.md) — get the app running on your machine
2. [Quickstart](getting-started/quickstart.md) — bank account, combine, first plan, first trade, first review, in five minutes
3. [Philosophy](getting-started/philosophy.md) — why the app is opinionated and what that means for you

## Concepts

How the app models your trading. Read once, internalize, then come back when something surprises you.

- [Accounts and categories](concepts/accounts-and-categories.md) — combine, sim funded, live funded, cash, bank, and when each one applies
- [The two ledgers](concepts/the-two-ledgers.md) — sim money versus real money, what crosses the bridge, why live-funded P&L doesn't count until withdrawn
- [Plans and trades](concepts/plans-and-trades.md) — the plan → trade → review loop and why it matters
- [R-multiples](concepts/r-multiples.md) — why R beats dollars and why percentages are absent
- [Drawdown modes](concepts/drawdown-modes.md) — static, EOD trailing, intraday trailing, lock offsets, lock on payout
- [The risk engine](concepts/the-risk-engine.md) — blockers, warnings, and overrides
- [Fees and fee attribution](concepts/fees-and-fee-attribution.md) — why a fee paid from your bank can be tagged to a combine

## Guides

Task-oriented walkthroughs. Each one answers a single "how do I..." question.

### Setup
- [Setting up your first account](guides/setting-up-your-first-account.md)
- [Configuring prop firm rules](guides/configuring-prop-firm-rules.md) — translating Apex, Topstep, Tradeify, and others into the account form

### Logging trades
- [Logging a normal trade](guides/logging-a-normal-trade.md)
- [Logging a scale-out trade](guides/logging-a-scale-out-trade.md) — the weighted-average approach
- [Logging a scale-in trade](guides/logging-a-scale-in-trade.md)
- [Moving your stop](guides/moving-your-stop.md)
- [Overriding a risk block](guides/overriding-a-risk-block.md)

### Plans
- [Writing a plan](guides/writing-a-plan.md)
- [Taking a plan](guides/taking-a-plan.md)

### Reviewing
- [Reviewing a closed trade](guides/reviewing-a-closed-trade.md)

### Money
- [Recording a payout](guides/recording-a-payout.md)
- [Recording subscription fees](guides/recording-subscription-fees.md)
- [Transferring between accounts](guides/transferring-between-accounts.md)
- [Archiving a failed combine](guides/archiving-a-failed-combine.md)

### Organization
- [Using tags](guides/using-tags.md)
- [Attaching screenshots](guides/attaching-screenshots.md)

## FAQ

[Frequently asked questions](faq.md) — edge cases, common confusions, and the things nobody thinks to ask until they hit them.

---

## How to read this knowledge base

Three layers, three reading paths:

- **Concepts** explain the model. Read these when something the app does feels unexpected — the answer is usually that you're missing a concept, not that the app is wrong.
- **Guides** explain a workflow. Read these when you have a specific task in front of you and want a step-by-step.
- **Reference** (coming after launch) explains every page, form, field, and URL parameter. Read these when you need a complete answer to "what does this button do?"

Each guide links forward to the relevant reference, and back up to the concept it depends on. Each concept lists the guides it unlocks. You can drop into any layer and find your way out.

## Versioning

This documentation lives in the same repository as the app. When the app changes, the docs change in the same commit. If you forked the repo, your docs match your fork. If you're reading this on a hosted docs site, the version should match the app version you're running — check **Settings → Diagnostics** to confirm.
