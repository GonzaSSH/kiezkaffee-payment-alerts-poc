// Formats the simulated Slack messages. By design (requirement R10) they never
// include the customer's name or email: those stay in the ops console.
import type { Alert } from './types';
import { orderLabel } from './format';

export const SLACK_CHANNEL = '#payments';

function failureBody(alert: Alert): string {
  return (
    `Reason: ${alert.title}. ${alert.explanation}\n` +
    `Next step: ${alert.nextStep}\n` +
    'Contact details: in the ops console (not shared in Slack).'
  );
}

export function failedMessage(alert: Alert): string {
  return `🚨 Payment failed: order ${orderLabel(alert.orderId)} (${alert.amount})\n${failureBody(alert)}`;
}

export function failedAgainMessage(alert: Alert): string {
  return `🔁 Payment failed again: order ${orderLabel(alert.orderId)} (${alert.amount})\n${failureBody(alert)}`;
}

export function recoveredMessage(alert: Alert): string {
  return `✅ Recovered: order ${orderLabel(alert.orderId)} (${alert.amount}) was paid on retry. No action needed.`;
}
