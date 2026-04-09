# Frequently asked questions

Edge cases, common confusions, and the things nobody thinks to ask until they hit them. Use the concept pages for the *why* and the guides for the *how*; this page is for the *wait, but what about...?* moments in between.

---

## Getting started

### Why does the app insist on stops?

Because an entry without a stop isn't a trade, it's a mistake waiting to happen. Futures move fast, one
tick can be worth a lot of money, and the difference between a losing trade and a career-ending trade is
usually whether you defined your out before you pressed the button.

The app enforces this with a shape validator in `src/lib/calc.js`: any trade draft that doesn't have a stop
gets rejected before it can be saved. There's no override, no "just this once" toggle, no way around it.
If you were running a mental stop or a time stop, enter your worst-case exit price as the stop and record
the nuance in your notes — the database needs a number.

See the [Philosophy](getting-started/philosophy.md) page for why this is one of the few things the app is
completely rigid about.

### Can I use this for stocks or crypto?

No. The entire math path — P&L, risk, R-multiple, contract caps, drawdown enforcement — assumes
`point_value × contracts` dollar P&L, which is the futures model. Stocks and crypto need different math
(shares, fractional positions, percentage P&L), and the app deliberately doesn't support them because
trying to be a generalized journal would dilute everything that makes it useful for futures traders.

If you trade both, use this for your futures and something else for your stocks. They're different games
anyway.

### Can I run it on Linux?

The stack (Tauri 2 + Vite + SQLite) builds for Linux, and the Rust backend has no platform-specific code
outside the standard Tauri plugin surface, so in principle yes. In practice, pre-built Linux bundles aren't
something the project ships regularly — you'd need to build from source. See the developer README for
`npm run tauri build` and the Tauri prerequisites for your distribution.

### Where is my data stored?

Locally, in the standard Tauri app-data directory for your OS. On macOS that's
`~/Library/Application Support/com.adamwickwire.futuresjournal/`. You'll find three things there:

- `futures-journal.db` — the SQLite database with all your trades, plans, accounts, transactions, tags
- `images/` — chart screenshots attached to trades and plans
- `backups/` — automatic daily JSON backups (14-day rolling retention) plus any manual backups you created

Nothing ever leaves the machine. There's no cloud account, no telemetry, no ping-home. If you format your
drive, your journal is gone — so keep backups, ideally off the machine.

---

## Accounts

### What's the difference between Combine, Sim funded, and Live funded?

All three are simulated accounts for rule-tracking purposes, but they correspond to different stages of
the prop firm pipeline:

- **Combine / Evaluation** — you're paying a monthly subscription to the firm, trading against their rules
  to qualify for a funded account. Failing archives the account; passing advances you to sim funded.
- **Sim funded** — you've passed the combine. Still simulated trades under the hood, but now payouts are
  real money. Drawdown and daily loss rules are still enforced by the firm.
- **Live funded** — your fills hit the real market with the firm's capital. P&L is real in the sense that
  it represents real fills, but it's still not yours until you withdraw — the firm can revoke the account,
  change rules, or dispute a withdrawal. The app treats live-funded trade P&L as sim ledger until a payout
  actually crosses into your real world.

See [Accounts and categories](concepts/accounts-and-categories.md) for the full five-category model.

### Do I need a bank account if I only trade sim?

You don't *need* one. Everything works without it — you can log trades and track sim P&L with just a
combine. But the moment you start paying subscription fees or receiving payouts, you want somewhere to
anchor those real-money events, and the **Personal bank** category is exactly that anchor.

The clean shape is: one bank + one or more combines / funded accounts. The bank is where subs come out and
payouts go in. Without it, fee burn and payout history are harder to see as a coherent story.

### Why doesn't my bank account show up in the trade form?

Because bank accounts are ledger-only and don't hold trades. The trade form (and the plan form) filters
out bank-category accounts from the picker. If you want to record something on a bank account, it's
always a **transaction** (deposit, withdrawal, fee, payout, transfer), never a trade.

### Can I have more than one of the same prop firm account?

Yes. Create as many as you need and name them so you can tell them apart — `Apex 50k #1`, `Apex 50k #2`,
`Topstep 150k #1`. Each one is a fully independent row with its own balance, rules, drawdown floor, and
fee burn tally. The dashboard's Today panel shows one card per active account, so running three combines
in parallel gives you three side-by-side cards with their independent headroom.

### I failed a combine — should I delete the account?

No. Archive it. See [Archiving a failed combine](guides/archiving-a-failed-combine.md). The trades and
transactions stay on the record, the account is hidden from active views, and you can still pull it up
later to see what went wrong. Deleting would throw away the most instructive data you have.

---

## Trades

### How do I log a trade where I scaled out at a target and let a runner go?

The app uses a weighted-average approach for scale-outs — record a single trade with the blended exit
price and the total contract count. See [Logging a scale-out trade](guides/logging-a-scale-out-trade.md)
for the full walkthrough.

### How do I log a trade where I added size?

Similar weighted-average approach, but on the entry side. See
[Logging a scale-in trade](guides/logging-a-scale-in-trade.md).

### I moved my stop to break-even. Should I update the trade row?

Depends on whether the move changed your actual exit. If you moved to break-even and the trade never hit
the new stop (it went to target or you exited manually), leave the trade's stop as your original risk — that's
what the R-multiple math uses, and it's the honest record of what you were risking when you took the
position. If the break-even stop actually got hit and that's how you exited, update the exit price, not
the stop. See [Moving your stop](guides/moving-your-stop.md) for the rationale.

### The risk engine blocked my trade. Can I override it?

Yes. The form will prompt you for an override reason, and the override plus your reason gets recorded on
the trade row so you can see your discipline pattern over time. The point of the override isn't
frictionless dismissal — it's a speed bump that forces you to articulate *why* you're ignoring the warning,
which is usually enough to catch a bad decision. See
[Overriding a risk block](guides/overriding-a-risk-block.md).

### Why is my R-multiple negative on a winning trade?

It shouldn't be, unless something is wrong with the data. R-multiple is `(exit - entry) / (entry - stop)`
for longs and the mirror for shorts, so a winning long (exit > entry) with a valid stop (stop < entry)
should produce a positive R-multiple. If you're seeing a negative R on a winning trade, the most common
causes are:

- You flipped the direction (logged a short as a long, or vice versa)
- You entered the stop on the wrong side of entry
- You entered the exit on the wrong side of entry

Open the trade in edit mode and double-check the four prices (entry, stop, target, exit) and the direction.

### How do I delete a trade I logged by accident?

Open the trade detail page and click **Delete** in the top-right action row. You'll get a confirmation
dialog. Delete is permanent — the trade row and its tag associations and screenshots are all removed, and
the account balance is recomputed to reflect the deletion. Don't delete trades you genuinely took just
because the outcome was embarrassing; the whole point of the journal is the honest record.

---

## Plans

### Why do plans require a target?

Because a plan without a target isn't a plan, it's a hope. A complete thesis is "I get in here, I'm wrong
here, I'm done here" — the third part is what lets you know in advance whether the trade is worth taking
(via planned R:R), and it's what makes the plan honestly comparable to the actual trade after the fact.

The app enforces this at two levels: the plan form's inline validator rejects an empty target field, and
the `plans.target_price` column is `NOT NULL` in the database schema. You can't save a plan without one.

### Can I edit a plan after I've taken it?

No. Once a plan's status flips to **taken**, the plan form refuses to open it and displays a "Plan locked"
message instead. The plan is frozen as the historical record of what you committed to. If you need to
correct something about the actual execution, edit the **trade** row instead — the trade is the editable
surface once the plan has been taken.

### What's the difference between "invalidated" and "expired"?

Both are terminal states for a plan that never became a trade, and the app uses them as a loose
distinction for your own record-keeping:

- **Invalidated** — your thesis broke. You decided not to take the trade because the setup no longer made
  sense (support failed, news hit, conditions changed).
- **Expired** — the window passed without the setup triggering. You didn't actively decide against it; it
  just never reached your entry.

The app doesn't auto-expire plans or enforce the distinction. Use them however they help you think. Both
are reversible via **Reactivate** if the thesis comes back.

---

## Money and the ledger

### Why doesn't my live-funded account's P&L show up in the real money ledger?

Because live-funded P&L is conditional until you withdraw it. The firm can revoke the account, change
rules, dispute a withdrawal, or go out of business. Until actual dollars land in your real bank, the
money isn't yours in any meaningful sense, and the real ledger refuses to count it.

What *does* count is a **payout** transaction on the live-funded account. That's the sim-to-real bridge,
and it's the only thing that moves live-funded profits onto the real ledger. See
[The two ledgers](concepts/the-two-ledgers.md) for the full treatment.

### I received a payout — how do I record it?

Open the funded account, click **+ Add transaction**, pick **Payout** as the type, enter the amount,
save. That single transaction reduces the funded account's sim balance and adds to the real ledger in one
shot. See [Recording a payout](guides/recording-a-payout.md).

### I paid a combine subscription from my bank. How do I tie it to the combine?

Open the bank, click **+ Add transaction**, pick **Fee** as the type, and you'll see a **Paid for account**
dropdown appear — pick the combine. The fee will show up in the per-account fee burn table on the ledger
page. See [Recording subscription fees](guides/recording-subscription-fees.md).

### Why are internal transfers excluded from the real-money total?

Because they don't change your net worth. Moving $1000 from your bank to your cash brokerage doesn't make
you richer or poorer — it just moves money between two real-money pots you already owned. The ledger
still shows the event so you can see where money went, but it's tagged `internal_transfer` and excluded
from the Net real money total. See [Transferring between accounts](guides/transferring-between-accounts.md).

---

## Risk engine and rules

### The drawdown floor on my account looks wrong. What controls it?

The drawdown floor depends on three columns on the account row: `drawdown_mode` (`static`, `eod_trailing`,
or `intraday_trailing`), `trailing_dd` (the dollar size of the drawdown), and `dd_lock_offset` (the
optional lock threshold). If the floor looks wrong, the usual cause is a mismatch between one of those
fields and what your firm actually uses.

See [Drawdown modes](concepts/drawdown-modes.md) for the full math and the three modes. The account
detail page's DD room stat shows the live peak and a "locked" indicator when the lock has triggered.

### What's the difference between EOD trailing and intraday trailing?

Both modes trail a peak, but they sample the peak at different moments:

- **EOD trailing** — the peak is sampled only at session boundaries (end-of-day). Intraday fluctuations
  don't move the peak. This matches firms like Apex.
- **Intraday trailing** — the peak moves with every closed trade as running equity updates. Any new high
  in running equity raises the peak. This matches firms like Topstep.

The app uses closed-trade running equity as an honest proxy for intraday trailing — it can't watch tick
data because it doesn't receive tick data, but closed-trade equity is the best approximation available
from the data the journal has.

### Why doesn't the consistency rule block trades?

Because the consistency rule is "best day ≤ N% of total profit," and you can't evaluate it until you know
what the final-day total is going to be. The rule is fundamentally end-of-day — trying to enforce it
pre-trade would either block trades that are actually fine (false positives) or miss trades that really
do violate the rule (false negatives), and neither behavior is acceptable for a pre-trade check.

So the consistency rule is **display-only**. The account detail page shows a Consistency stat with the
current ratio, the limit, and a visual indicator when you're close to or over the limit. The dashboard's
Today panel includes a consistency row on accounts that have the rule configured. It's information, not
an enforcement gate. See [The risk engine](concepts/the-risk-engine.md).

---

## Data and safety

### How often does the app back up?

Once per day, automatically, on launch. The backup runs fire-and-forget after settings load. If today's
backup file already exists, it's skipped (the operation is idempotent), so launching the app multiple
times in a day doesn't produce multiple backups.

### Where are my backups stored?

In `<app_data>/backups/`, sandboxed on the Rust side — the four backup-related Tauri commands
(`list_backups`, `write_backup`, `read_backup`, `delete_backup`) canonicalize paths and refuse anything
outside the backup directory. On macOS that's
`~/Library/Application Support/com.adamwickwire.futuresjournal/backups/`.

The 14 most recent auto-backups are retained; older ones are pruned on the next launch. Manual backups
created via Settings are never auto-pruned.

### Can I restore a backup from a different machine?

Yes. The backup format is JSON and is portable across machines. Copy the backup file into the `backups/`
directory on the new machine, open Settings, find the file in the backup list, and click Restore. The
restore runs inside a transaction — if anything fails, the old database state is preserved.

You can also restore a backup file from anywhere on disk via the file-picker button in Settings, which is
the usual cross-machine workflow.

### Is my data sent anywhere?

No. There's no cloud sync, no telemetry, no analytics pings, no crash reporter, no account system. The
only network activity the app can even theoretically perform would be through Tauri's HTTP plugin, which
isn't loaded. Your trade data lives on your disk and only on your disk.

### How do I turn on privacy mode for screenshots?

Open **Settings** and toggle the privacy mode switch. Every dollar amount in the app is masked when
privacy mode is on — useful for screen-sharing, screenshots, or working in public. The setting is
persisted and applied at bootstrap before the first render, so no raw amounts flash on screen when you
relaunch.

---

## Misc

### Why does the sidebar have a ⌘K hint?

That's the command palette shortcut. Press ⌘K on macOS (or Ctrl+K on Windows/Linux) to open a command
palette overlay for navigating between pages and common actions. It's there as an alternative to clicking
through the sidebar when you want to keep your hands on the keyboard.

### The dashboard shows "Needs review" — what does that mean?

You have one or more **closed** trades that haven't been reviewed yet. The banner links to a filtered
view of the trades list (`#/trades?needs_review=1`) showing only the unreviewed closed trades. Click into
any of them, fill in the review form at the bottom of the trade detail page, and click **Mark reviewed**
— the trade leaves the bucket and the banner's count drops. See
[Reviewing a closed trade](guides/reviewing-a-closed-trade.md).

### Can I customize the column order in tables?

Not currently. Tables are fixed-column but many of them are sortable — click a column header to sort by
that column. Column order, visibility, and resize are not exposed as user preferences.

---

## Still stuck?

If your question isn't here and the guide for your task didn't answer it either, re-read the relevant
concept page. The [Concepts](README.md#concepts) section exists specifically for the "the app does X and
I don't understand why" case, and the answer is usually in one of those pages. [The two ledgers](concepts/the-two-ledgers.md),
[The risk engine](concepts/the-risk-engine.md), [Drawdown modes](concepts/drawdown-modes.md), and
[Accounts and categories](concepts/accounts-and-categories.md) together cover most of the shapes that
cause confusion.
