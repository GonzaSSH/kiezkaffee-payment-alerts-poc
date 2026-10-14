// Provider-neutral types. Nothing in this file knows about any particular
// payment provider: the provider adapter (src/provider/) translates into these.

/** Why a payment failed, in our own words (not the provider's codes). */
export type FailureReason =
  | 'declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'incorrect_cvc'
  | 'lost_or_stolen'
  | 'processing_error'
  | 'too_many_attempts'
  | 'unknown';

export interface Payment {
  id: string;
  /** The shop's order number, if the provider passed it along. */
  orderId: string | null;
  /** Amount in the smallest currency unit (cents). */
  amountMinor: number;
  /** ISO currency code, lower case (e.g. "eur"). */
  currency: string;
  customerEmail: string | null;
}

interface EventBase {
  eventId: string;
  /** When the provider created the event (unix seconds). */
  createdAt: number;
}

export type PaymentEvent =
  | (EventBase & {
      kind: 'payment_failed';
      payment: Payment;
      failure: { reason: FailureReason; providerCode: string };
    })
  | (EventBase & { kind: 'payment_succeeded'; payment: Payment })
  | (EventBase & { kind: 'unsupported'; providerType: string });

export type RejectionReason =
  | 'missing_header'
  | 'malformed_header'
  | 'timestamp_out_of_window'
  | 'signature_mismatch'
  | 'invalid_payload';

/** Thrown by a provider adapter when a notification must not be trusted. */
export class WebhookRejectedError extends Error {
  readonly reason: RejectionReason;
  constructor(reason: RejectionReason, message: string) {
    super(message);
    this.name = 'WebhookRejectedError';
    this.reason = reason;
  }
}

/**
 * THE SWAP BOUNDARY. The rest of the app only ever talks to a payment
 * provider through this one function. To change provider, write a new
 * adapter that implements it.
 */
export interface PaymentProviderAdapter {
  /** Verifies the notification is genuine, then translates it. Throws WebhookRejectedError. */
  parseVerifiedEvent(rawBody: string, headers: Record<string, string>): Promise<PaymentEvent>;
}

export interface Clock {
  /** Milliseconds since the unix epoch. */
  nowMs(): number;
}

export type AlertStatus = 'open' | 'recovered';

export interface Alert {
  paymentId: string;
  orderId: string | null;
  amount: string;
  maskedEmail: string | null;
  reason: FailureReason;
  title: string;
  explanation: string;
  nextStep: string;
  status: AlertStatus;
  attempts: number;
  raisedAtMs: number;
  /** Time from the provider creating the event to the alert being raised. */
  timeToAlertMs: number;
  resolvedAtMs: number | null;
}

export interface SlackMessage {
  channel: string;
  text: string;
  atMs: number;
}

export type LogOutcome =
  | 'alert_raised'
  | 'alert_updated'
  | 'alert_resolved'
  | 'duplicate'
  | 'rejected'
  | 'ignored'
  | 'recorded';

export interface LogEntry {
  seq: number;
  atMs: number;
  outcome: LogOutcome;
  /** null when the notification was rejected: its contents are not trusted. */
  eventId: string | null;
  orderId: string | null;
  paymentId: string | null;
  detail: string;
}
