---
title: how to calculate expectancy
date: 2026-07-01
read: 6 MIN
tag: MATH
cta: RUN THE NUMBERS
description: the one formula that tells you whether your strategy prints or bleeds. no vibes, no screenshots of wins — just arithmetic your P&L already knows.
---

everyone asks "what's your win rate" and nobody asks "what's your expectancy",
which is why everyone's win rate is 70% and everyone's account is down.

expectancy is the average amount you make (or donate) **per trade**, over many
trades. it's the whole strategy compressed into one number.

![expectancy formula](/assets/posts/expectancy-formula.svg)

## the formula

- **win%** — how often you win
- **avg win** — average size of a winner
- **loss%** — how often you lose (`1 − win%`)
- **avg loss** — average size of a loser, as a positive number

that's it. two multiplications and a subtraction. the market hides this from
you by paying you in dopamine instead of statistics.

## worked example

pull the last 50 trades out of your journal (you have a journal, right?):

| metric | value |
|---|---|
| trades | 50 |
| winners | 20 (40%) |
| avg win | $300 |
| losers | 30 (60%) |
| avg loss | $120 |

```text
expectancy = (0.40 × 300) − (0.60 × 120)
           = 120 − 72
           = +$48 per trade
```

40% win rate. sounds like a losing strategy at a dinner party. it makes $48
every time you click. meanwhile the guy with a 90% win rate scalping 1:10
reward-to-risk is slowly wiring his account to someone with this formula.

## in python, because of course

```python
def expectancy(trades: list[float]) -> float:
    wins = [t for t in trades if t > 0]
    losses = [t for t in trades if t <= 0]
    if not trades:
        return 0.0
    win_rate = len(wins) / len(trades)
    avg_win = sum(wins) / len(wins) if wins else 0
    avg_loss = abs(sum(losses) / len(losses)) if losses else 0
    return win_rate * avg_win - (1 - win_rate) * avg_loss

print(expectancy([300, -120, 250, -100, 400, -150]))  # your future, per trade
```

feed it your real trade log, not the trades you remember. memory is a
marketing department.

## why it beats win rate

run two systems with the same 40% win rate for 1000 trades — one with the
math above, one where the losers are bigger than the winners:

![positive vs negative expectancy equity curves](/assets/posts/expectancy-curves.svg)

same win rate. same market. same coffee. the only difference is which side of
the subtraction is heavier.

## the R-multiple shortcut

if you risk the same amount every trade (you should — see the position dealer
in the jankyard), express everything in R, where 1R = your risk per trade:

> expectancy (in R) = (win% × avg R win) − (loss% × 1)
>
> anything above **+0.2R** per trade is a real edge. anything below zero is a
> subscription service where you're the product.

## the catch

expectancy is a *long-run* average. it says nothing about the ride — a +$48
expectancy still hands you eight losers in a row sometimes, and that's where
the monte carlo sim in the jankyard earns its keep. expectancy tells you *if*
you should trade the system. drawdown math tells you if you'll *survive* it.

calculate it once and you can't unsee it. which, depending on your strategy,
is either great news or a funeral.
