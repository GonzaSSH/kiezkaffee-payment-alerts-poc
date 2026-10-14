// The provider adapter is the swap boundary: Stripe-shaped in, PaymentEvent out.
import { describe, expect, it } from 'vitest';
import { createStripeStyleAdapter, mapFailureReason } from '../../src/provider/adapter';
import { signatureHeader } from '../../src/provider/signature';
import { DEMO_WEBHOOK_SECRET } from '../../src/provider/config';
import { FIXED_NOW_MS, fixedClock } from './helpers';

const T = FIXED_NOW_MS / 1000;

async function parse(event: unknown) {
  const body = JSON.stringify(event);
  const adapter = createStripeStyleAdapter({ secret: DEMO_WEBHOOK_SECRET, clock: fixedClock() });
  const header = await signatureHeader(DEMO_WEBHOOK_SECRET, body, T);
  return adapter.parseVerifiedEvent(body, { 'Stripe-Signature': header });
}

const pi = (extra: Record<string, unknown> = {}) => ({
  id: 'pi_1',
  object: 'payment_intent',
  amount: 3200,
  currency: 'eur',
  receipt_email: 'a@example.com',
  metadata: { order_id: 'KK-1' },
  ...extra,
});

describe('mapFailureReason (Stripe codes → our own reasons)', () => {
  it.each([
    ['card_declined', 'generic_decline', 'declined'],
    ['card_declined', 'do_not_honor', 'declined'],
    ['card_declined', undefined, 'declined'],
    ['card_declined', 'insufficient_funds', 'insufficient_funds'],
    ['expired_card', 'expired_card', 'expired_card'],
    ['expired_card', undefined, 'expired_card'],
    ['incorrect_cvc', undefined, 'incorrect_cvc'],
    ['card_declined', 'incorrect_cvc', 'incorrect_cvc'],
    ['card_declined', 'lost_card', 'lost_or_stolen'],
    ['card_declined', 'stolen_card', 'lost_or_stolen'],
    ['processing_error', undefined, 'processing_error'],
    ['card_declined', 'card_velocity_exceeded', 'too_many_attempts'],
    ['card_declined', 'some_code_we_dont_know', 'unknown'],
    ['brand_new_error', undefined, 'unknown'],
    [undefined, undefined, 'unknown'],
  ])('code=%s decline_code=%s → %s', (code, decline, want) => {
    expect(mapFailureReason(code, decline)).toBe(want);
  });
});

describe('parseVerifiedEvent', () => {
  it('translates payment_intent.payment_failed', async () => {
    const event = await parse({
      id: 'evt_1',
      object: 'event',
      created: T,
      type: 'payment_intent.payment_failed',
      data: {
        object: pi({ last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds' } }),
      },
    });
    expect(event).toEqual({
      kind: 'payment_failed',
      eventId: 'evt_1',
      createdAt: T,
      payment: { id: 'pi_1', orderId: 'KK-1', amountMinor: 3200, currency: 'eur', customerEmail: 'a@example.com' },
      failure: { reason: 'insufficient_funds', providerCode: 'insufficient_funds' },
    });
  });

  it('keeps the most specific provider code for display', async () => {
    const event = await parse({
      id: 'evt_2',
      created: T,
      type: 'payment_intent.payment_failed',
      data: { object: pi({ last_payment_error: { code: 'expired_card' } }) },
    });
    expect(event.kind === 'payment_failed' && event.failure).toEqual({
      reason: 'expired_card',
      providerCode: 'expired_card',
    });
  });

  it('treats a failure with no error details as unknown (still alerts)', async () => {
    const event = await parse({
      id: 'evt_3',
      created: T,
      type: 'payment_intent.payment_failed',
      data: { object: pi({ last_payment_error: null }) },
    });
    expect(event.kind === 'payment_failed' && event.failure).toEqual({ reason: 'unknown', providerCode: 'none' });
  });

  it('translates payment_intent.succeeded', async () => {
    const event = await parse({ id: 'evt_4', created: T, type: 'payment_intent.succeeded', data: { object: pi() } });
    expect(event.kind).toBe('payment_succeeded');
  });

  it('handles a missing order number and email', async () => {
    const event = await parse({
      id: 'evt_5',
      created: T,
      type: 'payment_intent.succeeded',
      data: { object: pi({ metadata: {}, receipt_email: null }) },
    });
    expect(event.kind === 'payment_succeeded' && event.payment.orderId).toBeNull();
    expect(event.kind === 'payment_succeeded' && event.payment.customerEmail).toBeNull();
  });

  it('marks other event types as unsupported', async () => {
    const event = await parse({ id: 'evt_6', created: T, type: 'charge.failed', data: { object: {} } });
    expect(event).toEqual({ kind: 'unsupported', eventId: 'evt_6', createdAt: T, providerType: 'charge.failed' });
  });

  it('finds the signature header regardless of capitalisation', async () => {
    const body = JSON.stringify({ id: 'e', created: T, type: 'x', data: { object: {} } });
    const adapter = createStripeStyleAdapter({ secret: DEMO_WEBHOOK_SECRET, clock: fixedClock() });
    const header = await signatureHeader(DEMO_WEBHOOK_SECRET, body, T);
    await expect(adapter.parseVerifiedEvent(body, { 'stripe-signature': header })).resolves.toBeDefined();
    await expect(adapter.parseVerifiedEvent(body, { 'STRIPE-SIGNATURE': header })).resolves.toBeDefined();
  });

  it.each([
    ['not JSON', 'not json at all'],
    ['JSON but not an object', '[1,2,3]'],
    ['missing id', JSON.stringify({ created: T, type: 'x', data: { object: {} } })],
    ['missing type', JSON.stringify({ id: 'e', created: T, data: { object: {} } })],
    [
      'payment without an amount',
      JSON.stringify({ id: 'e', created: T, type: 'payment_intent.succeeded', data: { object: { id: 'pi' } } }),
    ],
  ])('rejects a correctly signed but invalid payload (%s)', async (_name, body) => {
    const adapter = createStripeStyleAdapter({ secret: DEMO_WEBHOOK_SECRET, clock: fixedClock() });
    const header = await signatureHeader(DEMO_WEBHOOK_SECRET, body, T);
    await expect(adapter.parseVerifiedEvent(body, { 'Stripe-Signature': header })).rejects.toMatchObject({
      reason: 'invalid_payload',
      message: 'Payload is not a valid event',
    });
  });
});
