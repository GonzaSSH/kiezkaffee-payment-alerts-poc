# Discovery notes: Kiezkaffee, first call

> **Fictional.** These notes are from an imagined 45-minute discovery call. The people
> and answers are invented to show how requirements come out of discovery.

**Attendees (Kiezkaffee):** Lena (co-founder, head of operations), Murat (customer
support lead), Jonas (freelance developer, joined for the last 15 minutes)
**Attendees (us):** Solutions Engineer
**Goal of the call:** understand the problem, who feels it, and what "fixed" means,
before proposing anything.

---

## 1. Questions and answers

### The business problem

| # | Question | Answer |
|---|---|---|
| Q1 | Walk me through the last time a payment failed and you found out late. What happened? | *Murat:* "Last Saturday a customer's €90 subscription renewal failed. We saw it Monday morning. She'd already cancelled and emailed us that she was 'trying another roaster'." |
| Q2 | How many payments fail, roughly? | *Lena:* "The dashboard says about 4% fail on the first try. That's maybe 70 a month." |
| Q3 | Of those, how many do you get back today? | *Murat:* "Maybe one in ten. Only the ones we catch the same morning." |
| Q4 | If you could fix one thing, what would it be? | *Lena:* "Just *knowing*. Fast. We're good at talking to customers, but we can't talk to them if we don't know." |
| Q5 | What would make this project a failure in your eyes? | *Lena:* "If it cries wolf. If my team learns to ignore it, it's worse than nothing." |

### How the team works

| # | Question | Answer |
|---|---|---|
| Q6 | Where does your team actually look during the day? | *Murat:* "Slack, all day. Email less. Nobody opens the payment dashboard unless they have to." |
| Q7 | Who should act on a failed payment? | *Murat:* "Support, me and one colleague, 8:00–18:00 on weekdays and 10:00–14:00 on Saturdays." |
| Q8 | What do you do today to recover an order? | *Murat:* "Email the customer with a link to pay again, or ask them to try another card. If the card expired, we ask them to update it." |
| Q9 | Do you understand the provider's failure reasons? | *Murat:* "No. 'do_not_honor'? 'generic_decline'? I google them every time." |
| Q10 | When a customer complains, how do you work out what happened? | *Murat:* "I search the dashboard by email, then guess. It can take 15 minutes." |

### Technology

| # | Question | Answer |
|---|---|---|
| Q11 | Which payment provider, and do you receive its notifications (webhooks) today? | *Jonas:* "Stripe-style card payments. Webhooks only for 'payment succeeded', which creates the order. We ignore failures." |
| Q12 | Who would maintain an integration? | *Jonas:* "Me, a few hours a month at most. It has to be small and boring." |
| Q13 | Are you planning to change payment provider? | *Lena:* "Maybe next year. Our bank keeps offering us a deal." |
| Q14 | Where could new code run? | *Jonas:* "We already pay for a small serverless setup for the shop. Something there is fine." |

### Security and data protection

| # | Question | Answer |
|---|---|---|
| Q15 | What customer data is OK to show, and where? | *Lena:* "Our data protection advisor will ask about this. Slack is a US company. She doesn't want customer names, emails or card details sitting in Slack." |
| Q16 | How long should you keep the event history? | *Lena:* "As short as is useful. A month? We'd need to ask the advisor." |
| Q17 | What if someone sends fake notifications to the integration? | *Jonas:* "Good question. I hadn't thought about it. That must not create fake alerts." |

---

## 2. Requirements that came out of the call

| ID | Requirement | Source | Priority |
|---|---|---|---|
| R1 | Alert the support team **within 60 seconds** of a failed payment | Q1, Q4 | Must |
| R2 | Alerts go where the team already looks: **Slack**, plus a simple ops console | Q6 | Must |
| R3 | Every alert explains the reason **in plain language** with a **suggested next step** | Q8, Q9 | Must |
| R4 | **No false alerts:** repeated notifications must never alert twice | Q5 | Must |
| R5 | **Reject fake notifications:** verify every notification's signature | Q17 | Must |
| R6 | **Every** failure alerts, even reasons we don't recognise (never fail silently) | Q4, Q5 | Must |
| R7 | When a customer retries and pays, mark the alert **recovered**, so nobody chases a saved order | Q5, Q8 | Should |
| R8 | Log every notification (accepted, duplicate or rejected) so support can trace a payment in **< 2 minutes** | Q10 | Must |
| R9 | Slack messages must contain **enough detail to act on** (who to contact, about which order) | Q6, Q8 | Must |
| R10 | **No customer personal data in Slack** (name, email, card details) | Q15 | Must |
| R11 | Keep the payment provider behind **one clear boundary**, so changing provider later does not mean a rewrite | Q13 | Should |
| R12 | Small enough for one freelance developer to maintain | Q12 | Must |
| R13 | Keep event history only as long as needed (proposed: 30 days, to confirm with the advisor) | Q16 | Should |

---

## 3. Conflicting requirements and how we resolved them

### R9 "enough detail to act on" vs. R10 "no personal data in Slack"

**The conflict.** Murat wants the Slack message to say *who* to contact. Then he can
email the customer straight from his phone without opening anything else. Lena's data
protection advisor does not want names, email addresses or card details copied into
Slack. Slack is a third-party service, messages are hard to delete reliably, and every
copy of personal data is one more thing to secure and to report on under GDPR. Both
are reasonable, and they cannot both be fully true.

**Options we discussed**

| Option | R9 Actionable | R10 Data protection | Verdict |
|---|---|---|---|
| A. Full details in Slack (name, email, last 4 card digits) | ✅ | ❌ | Rejected by the advisor |
| B. Slack only says "a payment failed" | ❌ Murat must go digging | ✅ | Rejected: too slow, breaks R1 in practice |
| **C. Slack shows the order number, amount, plain-language reason and next step, plus a link to the ops console. Customer contact details stay in the ops console (and the shop admin), behind a login.** | ✅ one click away | ✅ | **Chosen** |

**Resolution.** Option C. The Slack message has everything needed to *decide* what to
do: the order number, amount, reason and suggested next step. The *who* (contact
details) is one click away in a place Kiezkaffee controls. Murat agreed after we
mocked it up: "One click is fine. Scrolling the dashboard for 15 minutes is the
problem." The demo shows this split: the Slack message tells support to open the ops console.
The clickable link needs a real console address, so it comes with the real deployment. The Slack message never includes a
name or email address. The ops console shows a masked email (`l•••@example.com`) to
show where contact details would live.

**What we gave up.** One extra click for support on every alert.

---

## 4. Open questions / follow-ups

- [ ] Advisor to confirm a 30-day retention period for the event log (R13).
- [ ] Out-of-hours alerts: should Saturday-evening failures notify anyone? (Today's answer: no. They queue for the morning, and the console shows them first.)
- [ ] Jonas to confirm the webhook signing secret can be kept in the serverless platform's secret store.
