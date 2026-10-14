// The integration: what happens to every notification, in order.
//   1. verify the signature   (provider adapter: the swap boundary)
//   2. ignore duplicates
//   3. explain the failure    (plain language + next step)
//   4. raise / update / resolve the alert, post to Slack
//   5. log the outcome
import { createAlerts } from './alerts';
import { createDedupe } from './dedupe';
import { orderLabel } from './format';
import { createLog } from './log';
import { SLACK_CHANNEL, failedAgainMessage, failedMessage, recoveredMessage } from './slack';
import {
  WebhookRejectedError,
  type Alert,
  type Clock,
  type LogEntry,
  type PaymentEvent,
  type PaymentProviderAdapter,
  type SlackMessage,
} from './types';

export type Integration = ReturnType<typeof createIntegration>;

export function createIntegration(deps: { adapter: PaymentProviderAdapter; clock: Clock }) {
  const { adapter, clock } = deps;
  const dedupe = createDedupe();
  const alerts = createAlerts(clock);
  const log = createLog(clock);
  let slack: SlackMessage[] = [];
  // Providers don't promise delivery order, so remember which payments are paid:
  // a failure that arrives after the success must not raise an alert.
  const paid = new Set<string>();
  const listeners = new Set<() => void>();

  const postToSlack = (text: string) => slack.push({ channel: SLACK_CHANNEL, text, atMs: clock.nowMs() });

  function handle(event: PaymentEvent): LogEntry {
    if (event.kind === 'unsupported') {
      return log.add({
        outcome: 'ignored',
        eventId: event.eventId,
        orderId: null,
        paymentId: null,
        detail: `Event type ${event.providerType} is not handled: ignored`,
      });
    }

    const { payment } = event;
    const ids = { eventId: event.eventId, orderId: payment.orderId, paymentId: payment.id };
    const order = orderLabel(payment.orderId);
    const existing: Alert | undefined = alerts.get(payment.id);

    if (event.kind === 'payment_succeeded') {
      paid.add(payment.id);
      if (existing?.status === 'open') {
        alerts.resolve(existing);
        postToSlack(recoveredMessage(existing));
        return log.add({ ...ids, outcome: 'alert_resolved', detail: `Order ${order} paid on retry: alert marked recovered` });
      }
      return log.add({ ...ids, outcome: 'recorded', detail: `Payment succeeded for order ${order}: no open alert` });
    }

    if (paid.has(payment.id)) {
      return log.add({
        ...ids,
        outcome: 'recorded',
        detail: `Late failure notification for order ${order}: payment already succeeded, no alert`,
      });
    }
    const { reason, providerCode } = event.failure;
    if (existing?.status === 'open') {
      alerts.update(existing, reason, providerCode);
      postToSlack(failedAgainMessage(existing));
      return log.add({ ...ids, outcome: 'alert_updated', detail: `Order ${order} failed again: ${existing.title}. Alert updated` });
    }
    const alert = alerts.raise(payment, reason, providerCode, event.createdAt);
    postToSlack(failedMessage(alert));
    return log.add({ ...ids, outcome: 'alert_raised', detail: `Alert raised for order ${order}: ${alert.title}` });
  }

  async function process(rawBody: string, headers: Record<string, string>): Promise<LogEntry> {
    let event: PaymentEvent;
    try {
      event = await adapter.parseVerifiedEvent(rawBody, headers);
    } catch (error) {
      if (!(error instanceof WebhookRejectedError)) throw error;
      // The body is not trusted, so nothing from it goes into the log.
      return log.add({
        outcome: 'rejected',
        eventId: null,
        orderId: null,
        paymentId: null,
        detail: `${error.message}. Notification rejected, no alert`,
      });
    }

    // No "await" from here on: the duplicate check and the alert happen in one
    // uninterrupted step, so two copies arriving together cannot both alert.
    if (!dedupe.firstTime(event.eventId)) {
      const payment = event.kind === 'unsupported' ? null : event.payment;
      return log.add({
        outcome: 'duplicate',
        eventId: event.eventId,
        orderId: payment?.orderId ?? null,
        paymentId: payment?.id ?? null,
        detail: 'Duplicate of an event already processed: ignored, no new alert',
      });
    }
    return handle(event);
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    /** Entry point for every notification. In production: the HTTPS webhook handler. */
    async receiveWebhook(rawBody: string, headers: Record<string, string>): Promise<LogEntry> {
      try {
        return await process(rawBody, headers);
      } finally {
        notify();
      }
    },
    getAlerts: (): Alert[] => alerts.all(),
    getSlackMessages: (): SlackMessage[] => slack.map((m) => ({ ...m })),
    getLog: (): LogEntry[] => log.all(),
    reset(): void {
      dedupe.clear();
      paid.clear();
      alerts.clear();
      log.clear();
      slack = [];
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
