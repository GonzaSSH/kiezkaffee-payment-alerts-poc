# Demo script (5 minutes)

> **Fictional customer, simulated payment provider.** Say so once, early, then move on.

**Audience:** Kiezkaffee (Lena, Murat, Jonas), or a hiring manager watching the recording.
**Set-up before recording:**
- Open the live demo in a fresh tab and click **Reset demo**.
- Window about 1,400 px wide, zoom 110%, so the three panels sit side by side.
- Close other tabs and turn off notifications.

**The one sentence they should remember:**

> **"When a payment fails, your team knows within a minute, knows why, and knows what to do next."**

---

## 0:00–0:30 The problem

**Show:** the top of the page.

**Say:**
"Kiezkaffee is a Berlin coffee roaster. It's fictional, and so is the payment
provider in this demo. Nothing here touches real money. Today, when a card payment
fails, nobody notices for about four hours. By then the customer has bought coffee
somewhere else. That's around 70 orders and €2,000 a month. Murat, on the support team,
told us: *'We can't talk to customers if we don't know.'* So the goal is simple:
know within a minute."

## 0:30–1:15 How it fits together

**Show:** point at the three panels, left to right.

**Say:**
"On the left, the payment provider. It's simulated, which is why it has a dashed
border. When a payment fails, the provider sends a signed notification to our
integration. The integration checks the notification is genuine and new, translates
the reason into plain language, and alerts the team in two places: the ops console
in the middle, and Slack on the right, because Slack is where the team already works."

## 1:15–2:15 The everyday case

**Click:** **S2 Simulate: insufficient funds**.

**Say (as the alert appears):**
"A customer's card didn't have enough money. Look at three things.
First, *speed*: alerted in well under a second. The target was sixty.
Second, *why*, in plain words. Not a code like `insufficient_funds` that Murat used to google.
Third, *what to do next*: offer a new payment link."

**Point at Slack:**
"Slack gets the same message, but notice what's missing: no name, no email.
That was a real conflict in discovery. Support wanted contact details, and the data
protection advisor didn't want personal data in Slack. We resolved it: Slack says
*what* and *why*, and the contact details are one click away in the console, behind a login."

## 2:15–3:00 The happy ending

**Click:** **S4 Simulate: fails, then paid on retry**.

**Say:**
"A subscription renewal fails, and Slack lights up. A moment later the customer
retries with another card and pays. The alert turns green and says no action needed,
and Slack says so too. Nobody wastes time chasing an order that's already saved."

## 3:00–4:00 Why you can trust it

**Click:** **S5 Simulate: duplicate event**.

**Say:**
"Providers sometimes deliver the same notification twice. That's normal. Here it
arrived twice and we got one alert. The counter shows the repeat was ignored. Lena's
biggest fear was a tool that cries wolf, and this is how we avoid it."

**Click:** **S6 Simulate: invalid signature**.

**Say:**
"Now someone sends a fake failure notification. No alert. The log shows it was rejected
because the signature didn't match. Only the real provider can sign notifications."

**Click:** **S7 Simulate: unknown failure reason**.

**Say:**
"And if the provider sends a reason we've never seen? We still alert. Missing a
failure costs an order. An extra alert costs ten seconds."

## 4:00–4:40 Tracing what happened

**Scroll to:** the event log. **Type** `KK-10424` into **Trace a payment**.

**Say:**
"When a customer emails asking what happened, Murat types the order number and sees
the whole story: failed at this time, recovered at that time. It used to take him
fifteen minutes in the provider dashboard."

## 4:40–5:00 Close

**Say:**
"Everything you saw is tested automatically on every change: each scenario, on desktop
and on a phone. The documents cover the design, a support runbook and answers to the
CTO's questions. The provider code sits behind one boundary, so moving to real Stripe,
or to the bank's offer next year, means swapping one piece.

**When a payment fails, your team knows within a minute, knows why, and knows what to do next.**"

---

## If something goes wrong while recording

- **The page looks cluttered:** click **Reset demo** and start the section again.
- **A button seems stuck:** buttons pause for under a second while the provider "sends". Wait for it.
- **Asked a question you can't answer live:** "Good question. It's in the objections
  document, and I'll send it after." ([objections.md](objections.md))
