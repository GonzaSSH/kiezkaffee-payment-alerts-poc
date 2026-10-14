// Open and recovered alerts, one per payment.
import { explain } from './explain';
import { formatAmount, maskEmail } from './format';
import type { Alert, Clock, FailureReason, Payment } from './types';

export function createAlerts(clock: Clock) {
  let byPayment = new Map<string, Alert>();
  return {
    get(paymentId: string): Alert | undefined {
      return byPayment.get(paymentId);
    },
    raise(payment: Payment, reason: FailureReason, providerCode: string, eventCreatedAt: number): Alert {
      const now = clock.nowMs();
      const alert: Alert = {
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: formatAmount(payment.amountMinor, payment.currency),
        maskedEmail: maskEmail(payment.customerEmail),
        reason,
        ...explain(reason, providerCode),
        status: 'open',
        attempts: 1,
        raisedAtMs: now,
        timeToAlertMs: Math.max(0, now - eventCreatedAt * 1000),
        resolvedAtMs: null,
      };
      byPayment.set(payment.id, alert);
      return alert;
    },
    update(alert: Alert, reason: FailureReason, providerCode: string): void {
      Object.assign(alert, { reason, ...explain(reason, providerCode), attempts: alert.attempts + 1 });
    },
    resolve(alert: Alert): void {
      alert.status = 'recovered';
      alert.resolvedAtMs = clock.nowMs();
    },
    all(): Alert[] {
      return [...byPayment.values()].map((a) => ({ ...a }));
    },
    clear(): void {
      byPayment = new Map();
    },
  };
}
