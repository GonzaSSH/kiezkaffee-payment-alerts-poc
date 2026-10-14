# Runbook: "A payment failed but the alert didn't fire"

> **Fictional customer, simulated payment provider.** This runbook is written for the
> real deployment described in the [solution design](solution-design.md). Where the
> demo behaves differently, it says so.

**Who this is for:** Kiezkaffee's support team (first checks), and Jonas, the
freelance developer (deeper checks).
**Time to work through:** about 10 minutes.

Work through the steps in order and stop at the first one that explains the problem.

---

## Before you start: get the facts

Write down:

- [ ] The **order number** (e.g. KK-10424)
- [ ] Roughly **when** the customer tried to pay
- [ ] How you found out (customer email, provider dashboard, ...)

## Step 1: Did the payment actually fail? (support, 2 min)

Open the order in the **payment provider's dashboard** and search by order number.

| What you see | What it means | Next |
|---|---|---|
| No payment for this order | The customer never got as far as paying. Nothing failed, so there was nothing to alert. | Stop. Not an alert problem. |
| Payment **succeeded** | Nothing failed. | Stop. |
| Payment **failed** | An alert should have fired. | Go to step 2. |
| Payment is **processing** / **requires action** (e.g. 3-D Secure) | The customer hasn't finished paying yet. Abandoned checkouts don't alert (out of scope). | Stop, or contact the customer. |

## Step 2: Is the alert there, just not where you looked? (support, 2 min)

1. Open the **ops console** and use **Trace a payment** with the order number.
2. Check the result against this table:

| The event log shows | What it means | Next |
|---|---|---|
| `Alert raised` | The alert fired. Check Slack `#payments` and the console's **Recovered** alerts. | Go to step 3. |
| `Recovered` | The customer paid on retry, so the alert closed itself. | Stop. Nothing to do. |
| `Repeat ignored` only | Should never happen alone. A repeat needs an earlier copy. | Go to step 5 (developer). |
| `Rejected` around that time (no order number shown) | A notification arrived but failed the signature check. | Go to step 4 (developer). |
| **Nothing at all** | The notification never reached the integration. | Go to step 4 (developer). |

> **In the demo:** the log only holds what happened since the page was loaded or the
> demo was reset.

## Step 3: The alert fired, but nobody saw it in Slack (support, 2 min)

- [ ] Is the right **Slack channel** (`#payments`) muted for you?
- [ ] Did the alert land **outside support hours**? Then it is waiting in the console.
- [ ] If the console shows the alert but Slack has no message, a developer should
      check the Slack connection (step 6).

---

## Step 4: Nothing arrived, or it was rejected (developer, 5 min)

Check these in the **payment provider's dashboard** → *Developers* → *Webhooks*:

- [ ] **Is the webhook endpoint configured** and pointing at the integration's current URL?
- [ ] **Is it subscribed to the right events?** It needs `payment_intent.payment_failed`
      **and** `payment_intent.succeeded`. Other events are ignored and logged as `Ignored`.
- [ ] **Delivery attempts:** does the provider show failed deliveries (timeouts, HTTP
      errors)? Providers retry for a while, so a short outage delays alerts rather than
      losing them. Redeliver from the dashboard once fixed. A repeat is safe: the
      duplicate check means it never alerts twice.
- [ ] **If the log shows `Rejected`**, read the detail:

| Detail in the log | Usual cause | Fix |
|---|---|---|
| `Invalid signature: no signature matches this payload` | The **signing secret** in the integration doesn't match the provider's, e.g. after the endpoint was recreated or the secret was rolled | Copy the endpoint's signing secret from the provider into the integration's secret store, then redeliver |
| `Signature timestamp is outside the 300-second window` | Server clock is wrong, or the notification was replayed late | Check the server clock (NTP). Redeliver from the provider |
| `Missing signature header` / `Malformed signature header` | Something between the provider and the integration (proxy, firewall) strips or changes headers, **or** someone is sending fake requests | Check the proxy. If it's fake traffic, the integration is doing its job |
| `Payload is not a valid event` | The provider changed its format, or a proxy changed the body | Compare the raw body with the provider's documented format. Update the adapter (`src/provider/adapter.ts`) |

## Step 5: It arrived but didn't alert (developer, 5 min)

Find the notification in the log by order number:

| Log outcome | Meaning | Fix |
|---|---|---|
| `Ignored` (event type ...) | Wrong event type subscribed | Subscribe to `payment_intent.payment_failed` |
| `Repeat ignored` with no earlier `Alert raised` | The duplicate memory holds this event ID from an earlier delivery whose alert was later lost (e.g. a restart between steps) | Raise the alert by hand. Report it as a bug |
| `Alert updated` | The payment failed again while its alert was still open, so the **existing** alert was updated (by design: no second alert) | Look for the existing alert for the same order |
| `Recorded` | The payment succeeded | Nothing failed |

## Step 6: Slack is silent but the console has the alert (developer, 3 min)

- [ ] Is the Slack incoming-webhook URL still valid? Slack revokes it if the app is removed.
- [ ] Did the integration's logs show an error posting to Slack?
- [ ] Post a test message to the same URL.

> **In the demo:** Slack is simulated and drawn on the page, so it cannot fail separately.

---

## When to escalate

Escalate to Jonas (developer) **immediately** if:

- Several payments failed in the last hour and **none** alerted. The integration may be down.
- The log shows many `Rejected` lines you can't explain. Someone may be sending fake notifications.

## After the incident

- [ ] Recover the order (contact the customer, send a payment link).
- [ ] Note the cause and fix in the support log, so the next person finds it faster.
