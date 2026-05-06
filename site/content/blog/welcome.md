---
title: Why this exists
description: I was trading prop firms and couldn't find a journal that fit. So I built one.
date: 2026-05-05
---

I was trading futures through prop firms and needed somewhere to track
two things at once: my prop accounts (with their drawdown rules, daily
loss limits, contract caps, consistency percentages, all of it) and my
actual personal accounts — the bank account paying for combines, the
brokerage where the real money lived, the payouts coming back from
funded accounts.

I looked around. The journals I tried were either built for stock
swing-traders, or they let me log a trade but had no concept of *which
firm's rules I was breaking by logging it.* None of them treated the
sim ledger and the real-money ledger as separate things, which made
P&L numbers meaningless the moment subscription fees and payouts
entered the picture.

So I built this. It's opinionated because I had specific problems to
solve. It's local-only because I didn't want my trade data on someone
else's server. It's free because I already got what I needed out of it
and there's no reason to gate it.

If you're in the same spot — trading prop firms and looking for a tool
that takes prop firm rules seriously — give it a try. The
[docs](/docs/) explain how it works. The
[GitHub repo](https://github.com/WalrusQuant/futures-journal) is where
the code and releases live.
