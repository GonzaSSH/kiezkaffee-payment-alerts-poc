# Questions from Kiezkaffee's CTO, with honest answers

> **Fictional customer, simulated payment provider.** These answers are about the real
> deployment in the [solution design](solution-design.md), not the browser demo,
> unless they say "in the demo". They are not legal advice.

Short version: the integration is small, it never sees card numbers, it stores very
little, and when something goes wrong it is built to fail towards *more* alerts, never
silence.

---

## "Is it secure? Couldn't someone send us fake alerts?"

- **Every notification is checked before anything is trusted.** The provider signs each
  notification with a secret only it and the integration know (HMAC-SHA256, the same
  scheme Stripe uses). Anything unsigned, wrongly signed or changed in transit is
  rejected and logged, and raises no alert. Demo scenario S6 shows this.
- **Old notifications can't be replayed.** A signature older than 5 minutes is rejected.
- **The signature comparison takes the same time whatever the input**, so an attacker
  can't guess the signature by timing it.
- **No card numbers, ever.** The provider keeps card details. The notification does
  include the provider's payment record, which can carry billing name and address and
  the card's brand, last 4 digits and expiry. The integration **keeps only** the
  order number, amount, failure reason and the customer's email, and discards the rest.
  None of the discarded fields are logged or sent to Slack. Your PCI scope does not
  change, because full card numbers never arrive.
- **The secret stays on the server**, in the hosting platform's secret store. Secret
  rotation works without downtime: during a rotation the provider sends two
  signatures, and the integration accepts either.
- **Honest caveat about the demo:** its secret sits in the browser, visible to anyone.
  That is acceptable only because it is a demo value guarding nothing.

## "What if the payment provider is down?"

Two different cases:

1. **The provider can't take payments.** That's a checkout outage. Customers see an
   error at checkout and no order is created. This integration can't help with that,
   and it isn't what it's for. The provider's own status page and your shop's error
   monitoring cover it.
2. **The provider takes payments but its notifications are late.** Providers retry
   undelivered notifications automatically (Stripe retries for up to three days), so
   alerts arrive late but are not lost. The 60-second target depends on the provider
   delivering promptly. That is an assumption, written down in the solution design.

**And if *our* integration is down?** The provider keeps retrying. When the
integration comes back, the alerts arrive. The duplicate check makes retries safe:
they never alert twice. Notifications can also arrive **out of order** after an
outage. The integration handles that: a failure that arrives after the same payment
already succeeded does not raise an alert.

## "Data protection: what do you store, where, and for how long?"

| Data | Where | How long | Why |
|---|---|---|---|
| Order number, amount, payment ID, failure reason | Ops console and event log | 30 days, then deleted (to confirm with your advisor) | To act on the alert and trace what happened |
| Customer email | **Ops console only**, behind your admin login. Never in Slack, never in the log | 30 days, with the alert | So support can contact the customer |
| Card details | **Nowhere.** Never received | – | – |
| Slack messages | Slack | Your Slack retention | Contain **no personal data** by design: order number, amount, reason, next step |

- **Slack gets no personal data.** This was the conflict we resolved in discovery
  (R9 vs. R10). A test checks it on every change.
- **Hosting in the EU.** The integration runs on your existing serverless setup. Pick
  an EU region.
- **The demo stores nothing.** Everything lives in the browser tab and disappears on
  reload. Its fonts are bundled, so it makes no third-party requests.
- The legal basis and the exact retention period are for your data protection advisor
  to confirm. The design makes either answer easy to apply.

## "What does it cost?"

| Item | Estimate |
|---|---|
| Build the production version from this proof of concept | about **5–8 developer days**: real endpoint, secret store, 30-day storage, Slack connection, console behind login, tests carried over |
| Hosting | **€0–10/month.** At about 1,800 orders a month this is a few thousand small requests, well inside most serverless free tiers |
| Slack | €0 (an incoming webhook on your existing workspace) |
| Payment provider | No change. Notifications are included |
| Maintenance | about **1–2 hours/month** for Jonas: dependency updates, checking the log |

Against that: today about **€2,000/month** is lost to unrecovered failed payments. If
the alerts lift recovery from ~10% to ~40%, that's roughly **€700/month back** (30% × 72 orders × €32),
which pays for the build within a few months. (Illustrative numbers; the recovery rate
is what a pilot would measure.)

## "Will it scale?"

- **Volume:** ~1,800 orders/month means roughly 70 failures a month. Even at 100× that,
  it's a few requests per minute: trivial for a serverless function.
- **What has to change for production:** the demo keeps the duplicate memory, alerts and
  log in memory. Production needs a small store for them (a managed key-value store or
  one table) with 30-day expiry, so restarts and parallel instances share state.
  The duplicate check must then be a single atomic "insert if new" in that store. The
  in-memory version is race-free only because the browser runs one thing at a time.
- **Busy periods** (e.g. a Black Friday sale): failures are grouped per payment
  (a second failure updates the same alert), so the console stays readable.
- **Changing provider later:** all provider-specific code sits behind one boundary
  (`src/provider/`). A new provider means one new adapter, not a rewrite.

## "What does it *not* do?"

It doesn't retry payments for the customer, email customers automatically, page
anyone out of hours, or detect abandoned checkouts. Each of these is a sensible next
step once the basic alert has proven itself. See "What I would build next" in the
README.
