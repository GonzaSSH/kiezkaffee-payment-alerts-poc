// THE SWAP BOUNDARY: everything Stripe-shaped stops here. This adapter turns a
// signed, Stripe-style notification into our provider-neutral PaymentEvent.
// To support a different provider, write another adapter with the same
// parseVerifiedEvent() function; nothing in src/core/ needs to change.
import {
  WebhookRejectedError,
  type Clock,
  type FailureReason,
  type Payment,
  type PaymentEvent,
  type PaymentProviderAdapter,
} from '../core/types';
import { SIGNATURE_HEADER } from './config';
import { DEFAULT_TOLERANCE_SECONDS, verifySignatureHeader } from './signature';

// Stripe decline codes (stripe-go error.go), checked first: they are more specific.
const DECLINE_CODES: Record<string, FailureReason> = {
  generic_decline: 'declined',
  do_not_honor: 'declined',
  insufficient_funds: 'insufficient_funds',
  expired_card: 'expired_card',
  incorrect_cvc: 'incorrect_cvc',
  lost_card: 'lost_or_stolen',
  stolen_card: 'lost_or_stolen',
  processing_error: 'processing_error',
  card_velocity_exceeded: 'too_many_attempts',
};

// Stripe error codes, used when there is no decline code.
const ERROR_CODES: Record<string, FailureReason> = {
  expired_card: 'expired_card',
  incorrect_cvc: 'incorrect_cvc',
  processing_error: 'processing_error',
};

export function mapFailureReason(code: string | undefined, declineCode: string | undefined): FailureReason {
  if (declineCode !== undefined) return DECLINE_CODES[declineCode] ?? 'unknown';
  if (code === 'card_declined') return 'declined';
  return (code !== undefined && ERROR_CODES[code]) || 'unknown';
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

function invalid(): WebhookRejectedError {
  return new WebhookRejectedError('invalid_payload', 'Payload is not a valid event');
}

function toPayment(obj: Json): Payment {
  const id = str(obj.id);
  const amount = obj.amount;
  const currency = str(obj.currency);
  if (!id || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || !currency) throw invalid();
  const metadata = isObject(obj.metadata) ? obj.metadata : {};
  return {
    id,
    orderId: str(metadata.order_id) ?? null,
    amountMinor: amount,
    currency,
    customerEmail: str(obj.receipt_email) ?? null,
  };
}

function toPaymentEvent(event: Json): PaymentEvent {
  const eventId = str(event.id);
  const type = str(event.type);
  const createdAt = event.created;
  if (!eventId || !type || typeof createdAt !== 'number') throw invalid();

  if (type !== 'payment_intent.payment_failed' && type !== 'payment_intent.succeeded') {
    return { kind: 'unsupported', eventId, createdAt, providerType: type };
  }

  const obj = isObject(event.data) && isObject(event.data.object) ? event.data.object : null;
  if (!obj) throw invalid();
  const payment = toPayment(obj);

  if (type === 'payment_intent.succeeded') return { kind: 'payment_succeeded', eventId, createdAt, payment };

  const error = isObject(obj.last_payment_error) ? obj.last_payment_error : {};
  const code = str(error.code);
  const declineCode = str(error.decline_code);
  return {
    kind: 'payment_failed',
    eventId,
    createdAt,
    payment,
    failure: { reason: mapFailureReason(code, declineCode), providerCode: declineCode ?? code ?? 'none' },
  };
}

function findHeader(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

export function createStripeStyleAdapter(options: {
  secret: string;
  clock: Clock;
  toleranceSeconds?: number;
}): PaymentProviderAdapter {
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  return {
    async parseVerifiedEvent(rawBody, headers) {
      // Verify first. Nothing in the body is trusted until the signature checks out.
      const nowSeconds = Math.floor(options.clock.nowMs() / 1000);
      await verifySignatureHeader(rawBody, findHeader(headers, SIGNATURE_HEADER), options.secret, nowSeconds, tolerance);

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        throw invalid();
      }
      if (!isObject(parsed)) throw invalid();
      return toPaymentEvent(parsed);
    },
  };
}
