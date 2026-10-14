// The "extra rules" table at the bottom of scenarios/EXPECTED.md.
import { describe, expect, it } from 'vitest';
import { signatureHeader } from '../../src/provider/signature';
import { DEMO_WEBHOOK_SECRET, WRONG_SECRET } from '../../src/provider/config';
import { FIXED_NOW_MS, fixedClock, newIntegration } from './helpers';

const T = FIXED_NOW_MS / 1000;
const REJECT_TAIL = '. Notification rejected, no alert';

function failed(id: string, declineCode = 'generic_decline', paymentId = 'pi_x') {
  return {
    id,
    object: 'event',
    created: T,
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: paymentId,
        object: 'payment_intent',
        amount: 3200,
        currency: 'eur',
        receipt_email: 'secret.person@example.com',
        metadata: { order_id: 'KK-9' },
        last_payment_error: { code: 'card_declined', decline_code: declineCode },
      },
    },
  };
}

function succeeded(id: string, paymentId = 'pi_x') {
  const e = failed(id, 'x', paymentId);
  e.type = 'payment_intent.succeeded';
  return e;
}

async function signed(event: unknown, secret = DEMO_WEBHOOK_SECRET, t = T) {
  const rawBody = typeof event === 'string' ? event : JSON.stringify(event);
  return { rawBody, headers: { 'Stripe-Signature': await signatureHeader(secret, rawBody, t) } };
}

describe('rejections', () => {
  it('missing signature header', async () => {
    const i = newIntegration();
    await i.receiveWebhook(JSON.stringify(failed('evt_a')), {});
    expect(i.getLog().map((l) => [l.outcome, l.eventId, l.detail])).toEqual([
      ['rejected', null, 'Missing signature header' + REJECT_TAIL],
    ]);
    expect(i.getAlerts()).toEqual([]);
  });

  it('malformed signature header', async () => {
    const i = newIntegration();
    await i.receiveWebhook(JSON.stringify(failed('evt_a')), { 'Stripe-Signature': 'nonsense' });
    expect(i.getLog()[0]?.detail).toBe('Malformed signature header' + REJECT_TAIL);
  });

  it('timestamp older than 300 seconds (replay)', async () => {
    const i = newIntegration();
    const d = await signed(failed('evt_a'), DEMO_WEBHOOK_SECRET, T - 301);
    await i.receiveWebhook(d.rawBody, d.headers);
    expect(i.getLog()[0]?.detail).toBe('Signature timestamp is outside the 300-second window' + REJECT_TAIL);
    expect(i.getAlerts()).toEqual([]);
  });

  it('body tampered after signing', async () => {
    const i = newIntegration();
    const d = await signed(failed('evt_a'));
    await i.receiveWebhook(d.rawBody.replace('3200', '1'), d.headers);
    expect(i.getLog()[0]?.detail).toBe('Invalid signature: no signature matches this payload' + REJECT_TAIL);
  });

  it('signed correctly but not valid JSON', async () => {
    const i = newIntegration();
    const d = await signed('{not json');
    await i.receiveWebhook(d.rawBody, d.headers);
    expect(i.getLog()[0]?.detail).toBe('Payload is not a valid event' + REJECT_TAIL);
  });

  it('a rejected event does not count as seen: it is processed when it arrives correctly signed', async () => {
    const i = newIntegration();
    const bad = await signed(failed('evt_a'), WRONG_SECRET);
    const good = await signed(failed('evt_a'));
    await i.receiveWebhook(bad.rawBody, bad.headers);
    await i.receiveWebhook(good.rawBody, good.headers);
    expect(i.getLog().map((l) => l.outcome)).toEqual(['rejected', 'alert_raised']);
    expect(i.getAlerts()).toHaveLength(1);
  });
});

describe('other events', () => {
  it('ignores event types it does not handle', async () => {
    const i = newIntegration();
    const d = await signed({ id: 'evt_c', created: T, type: 'charge.failed', data: { object: {} } });
    await i.receiveWebhook(d.rawBody, d.headers);
    expect(i.getLog().map((l) => [l.outcome, l.detail])).toEqual([
      ['ignored', 'Event type charge.failed is not handled: ignored'],
    ]);
    expect(i.getAlerts()).toEqual([]);
    expect(i.getSlackMessages()).toEqual([]);
  });

  it('records a success with no open alert, without alerting', async () => {
    const i = newIntegration();
    const d = await signed(succeeded('evt_s'));
    await i.receiveWebhook(d.rawBody, d.headers);
    expect(i.getLog().map((l) => [l.outcome, l.detail])).toEqual([
      ['recorded', 'Payment succeeded for order KK-9: no open alert'],
    ]);
    expect(i.getAlerts()).toEqual([]);
    expect(i.getSlackMessages()).toEqual([]);
  });
});

describe('same payment fails again', () => {
  it('updates the open alert instead of raising a second one', async () => {
    const i = newIntegration();
    const first = await signed(failed('evt_1', 'generic_decline'));
    const second = await signed(failed('evt_2', 'insufficient_funds'));
    await i.receiveWebhook(first.rawBody, first.headers);
    await i.receiveWebhook(second.rawBody, second.headers);

    const alerts = i.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ title: 'Insufficient funds', attempts: 2, status: 'open' });
    expect(i.getLog().map((l) => [l.outcome, l.detail])).toEqual([
      ['alert_raised', 'Alert raised for order KK-9: Card declined'],
      ['alert_updated', 'Order KK-9 failed again: Insufficient funds. Alert updated'],
    ]);
    const slack = i.getSlackMessages().map((m) => m.text);
    expect(slack).toHaveLength(2);
    expect(slack[1]).toBe(
      '🔁 Payment failed again: order KK-9 (€32.00)\n' +
        'Reason: Insufficient funds. The card did not have enough money for this order.\n' +
        'Next step: Contact the customer and offer a new payment link, or ask for another card.\n' +
        'Contact details: in the ops console (not shared in Slack).',
    );
  });

  it('a later success after two failures resolves the single alert', async () => {
    const i = newIntegration();
    for (const e of [failed('evt_1'), failed('evt_2'), succeeded('evt_3')]) {
      const d = await signed(e);
      await i.receiveWebhook(d.rawBody, d.headers);
    }
    expect(i.getAlerts().map((a) => a.status)).toEqual(['recovered']);
  });
});

describe('duplicates', () => {
  it('two copies arriving at the same moment still raise exactly one alert', async () => {
    const i = newIntegration();
    const d = await signed(failed('evt_dup'));
    await Promise.all([
      i.receiveWebhook(d.rawBody, d.headers),
      i.receiveWebhook(d.rawBody, d.headers),
      i.receiveWebhook(d.rawBody, d.headers),
    ]);
    expect(i.getAlerts()).toHaveLength(1);
    expect(i.getSlackMessages()).toHaveLength(1);
    expect(i.getLog().map((l) => l.outcome).sort()).toEqual(['alert_raised', 'duplicate', 'duplicate']);
  });

  it('a duplicate of a success does not resolve twice or post twice', async () => {
    const i = newIntegration();
    for (const e of [failed('evt_1'), succeeded('evt_2'), succeeded('evt_2')]) {
      const d = await signed(e);
      await i.receiveWebhook(d.rawBody, d.headers);
    }
    expect(i.getSlackMessages()).toHaveLength(2);
    expect(i.getLog().map((l) => l.outcome)).toEqual(['alert_raised', 'alert_resolved', 'duplicate']);
  });
});

describe('data protection', () => {
  it('never puts the customer email in Slack, but shows it masked in the console', async () => {
    const i = newIntegration();
    for (const e of [failed('evt_1'), failed('evt_2', 'insufficient_funds'), succeeded('evt_3')]) {
      const d = await signed(e);
      await i.receiveWebhook(d.rawBody, d.headers);
    }
    for (const m of i.getSlackMessages()) {
      expect(m.text).not.toContain('secret.person');
      expect(m.text).not.toContain('@');
    }
    expect(i.getAlerts()[0]?.maskedEmail).toBe('s•••@example.com');
  });

  it('does not keep the full email in the log', async () => {
    const i = newIntegration();
    const d = await signed(failed('evt_1'));
    await i.receiveWebhook(d.rawBody, d.headers);
    expect(JSON.stringify(i.getLog())).not.toContain('secret.person');
  });
});

describe('state', () => {
  it('reset clears alerts, Slack, log and the duplicate memory', async () => {
    const i = newIntegration();
    const d = await signed(failed('evt_1'));
    await i.receiveWebhook(d.rawBody, d.headers);
    i.reset();
    expect([i.getAlerts(), i.getSlackMessages(), i.getLog()]).toEqual([[], [], []]);
    await i.receiveWebhook(d.rawBody, d.headers);
    expect(i.getLog().map((l) => l.outcome)).toEqual(['alert_raised']);
  });

  it('notifies subscribers on every change', async () => {
    const i = newIntegration();
    let calls = 0;
    const unsubscribe = i.subscribe(() => calls++);
    const d = await signed(failed('evt_1'));
    await i.receiveWebhook(d.rawBody, d.headers);
    unsubscribe();
    await i.receiveWebhook(d.rawBody, d.headers);
    expect(calls).toBe(1);
  });

  it('returns copies, so callers cannot change the integration state', async () => {
    const i = newIntegration(fixedClock());
    const d = await signed(failed('evt_1'));
    await i.receiveWebhook(d.rawBody, d.headers);
    const [alert] = i.getAlerts();
    if (!alert) throw new Error('expected an alert');
    alert.status = 'recovered';
    expect(i.getAlerts()[0]?.status).toBe('open');
  });
});
