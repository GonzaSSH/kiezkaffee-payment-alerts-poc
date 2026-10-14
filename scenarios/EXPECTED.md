# Expected outcomes per scenario

> **Fictional customer, simulated payment provider.** The fixtures in `fixtures/` are
> Stripe-shaped events (format taken from Stripe's official open-source libraries and
> API specification). They are not real Stripe data.

This file was written **before** any integration code. The code must match it, not the
other way round. `expected.json` holds the same values in a machine-readable form for
the tests, and a unit test checks that every expected text below also appears there.

## How to read this

- **Alert**: a card in the ops console. `open` means someone needs to act.
  `recovered` means the customer paid on retry and no action is needed.
- **Slack**: the simulated message posted to `#payments`. It never contains customer
  names or emails (requirement R10). Contact details stay in the ops console, masked
  in the demo.
- **Log**: one line per notification the integration handled, in order. Outcomes are
  `alert_raised`, `alert_resolved`, `duplicate`, `rejected`.
- **IDs and run numbers**: each click in the control panel is a new "run". The
  simulator adds `_r<run>` to the event and payment IDs, so clicking a scenario twice
  creates two separate failures instead of a duplicate. This file shows run 1. Inside
  one run, a scenario's own duplicate (S5) keeps the same ID.
- **Timing**: in every scenario that alerts, the alert must appear within 60 seconds of
  the event being created (success measure 1). In the browser this takes milliseconds.

## Summary

| # | Scenario | Alerts | Slack messages | Log lines |
|---|---|---|---|---|
| S1 | Card declined | 1 open | 1 | `alert_raised` |
| S2 | Insufficient funds | 1 open | 1 | `alert_raised` |
| S3 | Expired card | 1 open | 1 | `alert_raised` |
| S4 | Fails, then succeeds on retry | 1, ends **recovered** | 2 (failed, recovered) | `alert_raised`, `alert_resolved` |
| S5 | Duplicate event | **exactly 1** open | **exactly 1** | `alert_raised`, `duplicate` |
| S6 | Invalid signature | **0** | **0** | `rejected` |
| S7 | Unknown failure reason | 1 open (fail safe) | 1 | `alert_raised` |

---

## S1: Card declined

Provider sends `payment_intent.payment_failed` with `code: card_declined`,
`decline_code: generic_decline`.

**Alert (open)**

| Field | Expected |
|---|---|
| Order | KK-10421 |
| Amount | €32.00 |
| Customer (masked) | j•••@example.com |
| Title | Card declined |
| Explanation | The customer's bank declined the card and did not say why. |
| Next step | Contact the customer and ask them to use another card or payment method. |

**Slack**

```
🚨 Payment failed: order KK-10421 (€32.00)
Reason: Card declined. The customer's bank declined the card and did not say why.
Next step: Contact the customer and ask them to use another card or payment method.
Contact details: in the ops console (not shared in Slack).
```

**Log**

| Outcome | Event ID | Order | Detail |
|---|---|---|---|
| alert_raised | evt_sim_s1_failed_r1 | KK-10421 | Alert raised for order KK-10421: Card declined |

## S2: Insufficient funds

`code: card_declined`, `decline_code: insufficient_funds`.

**Alert (open)**

| Field | Expected |
|---|---|
| Order | KK-10422 |
| Amount | €54.50 |
| Customer (masked) | t•••@example.com |
| Title | Insufficient funds |
| Explanation | The card did not have enough money for this order. |
| Next step | Contact the customer and offer a new payment link, or ask for another card. |

**Slack**

```
🚨 Payment failed: order KK-10422 (€54.50)
Reason: Insufficient funds. The card did not have enough money for this order.
Next step: Contact the customer and offer a new payment link, or ask for another card.
Contact details: in the ops console (not shared in Slack).
```

**Log**

| Outcome | Event ID | Order | Detail |
|---|---|---|---|
| alert_raised | evt_sim_s2_failed_r1 | KK-10422 | Alert raised for order KK-10422: Insufficient funds |

## S3: Expired card

`code: expired_card`, `decline_code: expired_card`.

**Alert (open)**

| Field | Expected |
|---|---|
| Order | KK-10423 |
| Amount | €18.90 |
| Customer (masked) | a•••@example.com |
| Title | Expired card |
| Explanation | The card has expired. |
| Next step | Ask the customer to update their card details and pay again. |

**Slack**

```
🚨 Payment failed: order KK-10423 (€18.90)
Reason: Expired card. The card has expired.
Next step: Ask the customer to update their card details and pay again.
Contact details: in the ops console (not shared in Slack).
```

**Log**

| Outcome | Event ID | Order | Detail |
|---|---|---|---|
| alert_raised | evt_sim_s3_failed_r1 | KK-10423 | Alert raised for order KK-10423: Expired card |

## S4: Fails, then succeeds on retry

1. `payment_intent.payment_failed` (`insufficient_funds`) for payment `pi_sim_s4`.
2. `payment_intent.succeeded` for the **same** payment.

**Alert**: one alert, raised by step 1. Step 2 changes its status to **recovered**.
No second alert.

| Field | Expected |
|---|---|
| Order | KK-10424 |
| Amount | €90.00 |
| Customer (masked) | l•••@example.com |
| Title | Insufficient funds |
| Explanation | The card did not have enough money for this order. |
| Next step | Contact the customer and offer a new payment link, or ask for another card. |
| Final status | recovered |

**Slack** (two messages, in this order)

```
🚨 Payment failed: order KK-10424 (€90.00)
Reason: Insufficient funds. The card did not have enough money for this order.
Next step: Contact the customer and offer a new payment link, or ask for another card.
Contact details: in the ops console (not shared in Slack).
```

```
✅ Recovered: order KK-10424 (€90.00) was paid on retry. No action needed.
```

**Log**

| Outcome | Event ID | Order | Detail |
|---|---|---|---|
| alert_raised | evt_sim_s4_failed_r1 | KK-10424 | Alert raised for order KK-10424: Insufficient funds |
| alert_resolved | evt_sim_s4_succeeded_r1 | KK-10424 | Order KK-10424 paid on retry: alert marked recovered |

## S5: Duplicate event

The same `payment_intent.payment_failed` event (same ID, same body, `generic_decline`)
is delivered **twice**.

**Alert (open)**: **exactly one**.

| Field | Expected |
|---|---|
| Order | KK-10425 |
| Amount | €27.00 |
| Customer (masked) | m•••@example.com |
| Title | Card declined |
| Explanation | The customer's bank declined the card and did not say why. |
| Next step | Contact the customer and ask them to use another card or payment method. |

**Slack**: **exactly one** message.

```
🚨 Payment failed: order KK-10425 (€27.00)
Reason: Card declined. The customer's bank declined the card and did not say why.
Next step: Contact the customer and ask them to use another card or payment method.
Contact details: in the ops console (not shared in Slack).
```

**Log**

| Outcome | Event ID | Order | Detail |
|---|---|---|---|
| alert_raised | evt_sim_s5_failed_r1 | KK-10425 | Alert raised for order KK-10425: Card declined |
| duplicate | evt_sim_s5_failed_r1 | KK-10425 | Duplicate of an event already processed: ignored, no new alert |

## S6: Invalid signature

A `payment_intent.payment_failed` event signed with the **wrong secret**.

**Alert**: **none.** **Slack**: **none.**

**Log**: the notification is rejected. Its contents are **not trusted**, so the log
records no event ID or order number from it.

| Outcome | Event ID | Order | Detail |
|---|---|---|---|
| rejected | – | – | Invalid signature: no signature matches this payload. Notification rejected, no alert |

## S7: Unknown failure reason

`code: card_declined`, `decline_code: some_code_we_dont_know` (a reason the integration
has never seen).

**Alert (open)**: raised anyway. **Unknown reasons must never be silent** (R6).

| Field | Expected |
|---|---|
| Order | KK-10427 |
| Amount | €36.00 |
| Customer (masked) | n•••@example.com |
| Title | Unrecognised failure reason |
| Explanation | The payment provider gave a reason we don't recognise (some_code_we_dont_know). |
| Next step | Check this payment in the payment provider's dashboard, then contact the customer. |

**Slack**

```
🚨 Payment failed: order KK-10427 (€36.00)
Reason: Unrecognised failure reason. The payment provider gave a reason we don't recognise (some_code_we_dont_know).
Next step: Check this payment in the payment provider's dashboard, then contact the customer.
Contact details: in the ops console (not shared in Slack).
```

**Log**

| Outcome | Event ID | Order | Detail |
|---|---|---|---|
| alert_raised | evt_sim_s7_failed_r1 | KK-10427 | Alert raised for order KK-10427: Unrecognised failure reason |

---

## Extra rules tested outside the seven scenarios

These come from the plan and Stripe's signature scheme. They are covered by focused
unit tests:

| Rule | Expected |
|---|---|
| Signature header missing | `rejected`: "Missing signature header. Notification rejected, no alert" |
| Signature header malformed (no `t=` or no `v1=`) | `rejected`: "Malformed signature header. Notification rejected, no alert" |
| Correct signature but timestamp older than 300 seconds (replay) | `rejected`: "Signature timestamp is outside the 300-second window. Notification rejected, no alert" |
| Body changed after signing (tampering) | `rejected`: "Invalid signature: no signature matches this payload. Notification rejected, no alert" |
| Signed correctly but body is not valid JSON | `rejected`: "Payload is not a valid event. Notification rejected, no alert" |
| A rejected event later arrives correctly signed | Processed normally (rejections do not count as "seen") |
| Event type we don't handle (e.g. `charge.failed`) | `ignored`: "Event type charge.failed is not handled: ignored". No alert |
| `payment_intent.succeeded` with no open alert | `recorded`: "Payment succeeded for order <order>: no open alert". No alert, no Slack |
| The same payment fails again (new event ID, e.g. second card also declined) while its alert is open | **No second alert.** The existing alert is updated to the latest reason and shows 2 attempts. `alert_updated`: "Order <order> failed again: <title>. Alert updated". Slack: one message starting `🔁 Payment failed again: order <order> (<amount>)`, then the same Reason / Next step / Contact details lines |
| Two copies of the same event arrive at the same moment | Exactly one alert (the duplicate check cannot be raced) |
| Any Slack message | Never contains the customer's email address |
