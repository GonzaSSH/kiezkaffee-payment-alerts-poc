# Customer brief: Kiezkaffee

> **Fictional customer.** Kiezkaffee, its people and its numbers are invented for this
> portfolio project. The payment provider in the demo is **simulated** and is not
> affiliated with Stripe or any other company.

## Who they are

Kiezkaffee is a small specialty coffee roaster in Berlin-Mitte. It roasts twice a
week and sells beans and subscriptions through its own web shop, mostly to customers in
Germany and Austria.

| | |
|---|---|
| Team | 9 people. 2 handle customer support and order operations. |
| Online orders | about 1,800 per month |
| Average order | €32 |
| Payments | Card payments through a Stripe-style payment provider |
| Tech | Small custom web shop, maintained by one freelance developer. No in-house engineering team. |

## The problem

When a card payment fails, **nobody at Kiezkaffee finds out at the time**. Today, the
support team learns about failed payments in one of two ways:

1. They check the payment provider's dashboard by hand each morning and afternoon.
2. An annoyed customer emails to ask, "Did my order go through?"

By then the customer has usually left, bought somewhere else or forgotten. The order
is lost.

> "We only see failed payments when someone remembers to open the dashboard. By then
> the customer has bought their coffee at the supermarket."
> — Lena, co-founder and head of operations (fictional)

### What it costs today (estimates from discovery, illustrative)

| Metric | Today |
|---|---|
| Card payments that fail on the first attempt | ~4% → **~72 orders/month** |
| Typical time until someone notices | **~4 hours** (up to a full day on weekends) |
| Failed orders later recovered | **~10%** (~7 orders/month) |
| Revenue lost to unrecovered failures | ~65 orders × €32 ≈ **€2,000/month** (~€25,000/year) |
| Subscription customers lost after a failed renewal | unknown. Nobody tracks it. |

## What they asked for

- **Know quickly:** someone on the team finds out about a failed payment within a minute.
- **Know why:** in plain language, not as a code like `insufficient_funds`.
- **Know what to do:** a suggested next step so support can recover the order.
- **Trust it:** no false alerts from fake or repeated notifications. They need to be
  able to trace what happened when a customer complains.

## What success looks like

These are the numbers we agree to measure the proof of concept against:

| # | Success measure | Target | How the proof of concept shows it |
|---|---|---|---|
| 1 | Time from failed payment to alert | **≤ 60 seconds** (in the demo: under 1 second) | Each alert shows its "time to alert" |
| 2 | Failed payments that raise an alert | **100%**, including reasons we don't recognise | Scenario S7: an unknown reason still alerts |
| 3 | Duplicate alerts for one failure | **0** | Scenario S5: one event sent twice gives one alert |
| 4 | Fake (unsigned or wrongly signed) notifications accepted | **0** | Scenario S6: rejected and logged, no alert |
| 5 | Alerts with a plain-language reason and next step | **100%** | Every alert card and Slack message |
| 6 | Failed orders recovered | from ~10% to **≥ 40%** within 3 months of going live | Not provable in a demo. Measured in a pilot (see below) |
| 7 | Time for support to trace one payment's history | **< 2 minutes** | The event log, filtered by payment |

Measures 1–5 and 7 are proven by automated tests in this kit. Measure 6 is a business
outcome. It needs a 3-month pilot with real payments, and this proof of concept does
not claim to prove it.

## What this proof of concept is, and is not

**It is** a working, clickable demo of the alerting flow with a simulated payment
provider. It comes with the documents a team would need to decide whether to build it
for real.

**It is not** connected to any real payment provider, Slack workspace or customer
data. It does not store anything once you close the page.
