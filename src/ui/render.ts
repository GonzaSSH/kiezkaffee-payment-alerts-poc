import type { Alert, LogEntry, LogOutcome, SlackMessage } from '../core/types';
import { orderLabel } from '../core/format';
import type { Delivery, Scenario } from '../provider/simulator';
import { byId, h } from './dom';

const GOAL_MS = 60_000;

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function renderScenarioButtons(scenarios: Scenario[], onRun: (s: Scenario) => void): HTMLButtonElement[] {
  const list = byId('scenario-buttons');
  const buttons = scenarios.map((s) => {
    const button = h('button', { type: 'button', class: 'scenario', 'data-scenario': s.id },
      h('span', { class: 'scenario-id' }, s.id),
      h('span', { class: 'scenario-text' },
        h('span', { class: 'scenario-label' }, s.button),
        h('span', { class: 'scenario-desc' }, s.description),
      ),
    );
    button.addEventListener('click', () => onRun(s));
    return button;
  });
  list.replaceChildren(...buttons);
  return buttons;
}

function alertCard(a: Alert): HTMLElement {
  const recovered = a.status === 'recovered';
  const fraction = Math.min(1, a.timeToAlertMs / GOAL_MS);
  return h('article', {
      class: `alert ${recovered ? 'is-recovered' : 'is-open'}`,
      'data-testid': 'alert',
      'data-order': a.orderId ?? '',
      'data-status': a.status,
    },
    h('div', { class: 'alert-head' },
      h('p', { class: 'alert-status', 'data-testid': 'alert-status' }, recovered ? 'Recovered' : 'Needs action'),
      h('p', { class: 'alert-order' }, `Order ${orderLabel(a.orderId)}`, h('span', { class: 'alert-amount' }, a.amount)),
    ),
    h('h3', { class: 'alert-title', 'data-testid': 'alert-title' }, a.title),
    h('p', { class: 'alert-explanation', 'data-testid': 'alert-explanation' }, a.explanation),
    recovered
      ? h('p', { class: 'alert-next', 'data-testid': 'alert-next' }, 'The customer paid on retry. No action needed.')
      : h('p', { class: 'alert-next', 'data-testid': 'alert-next' }, h('strong', {}, 'Next step: '), a.nextStep),
    h('div', { class: 'alert-meta' },
      h('div', { class: 'speed' },
        h('p', { class: 'speed-figure', 'data-testid': 'time-to-alert' }, seconds(a.timeToAlertMs)),
        h('p', { class: 'speed-label' }, 'from failed payment to alert. Goal: under 60 s'),
        h('div', { class: 'speed-bar', role: 'img', 'aria-label': `${seconds(a.timeToAlertMs)} of the 60 second goal` },
          h('span', { style: `inline-size: ${Math.max(fraction * 100, 0.8)}%` }),
        ),
      ),
      h('dl', { class: 'alert-facts' },
        h('dt', {}, 'Customer'), h('dd', { 'data-testid': 'alert-email' }, a.maskedEmail ?? 'unknown'),
        h('dt', {}, 'Attempts'), h('dd', {}, String(a.attempts)),
        h('dt', {}, 'Payment'), h('dd', { class: 'mono' }, a.paymentId),
      ),
    ),
  );
}

export function renderAlerts(alerts: Alert[]): void {
  const container = byId('alerts');
  if (alerts.length === 0) {
    container.replaceChildren(
      h('p', { class: 'empty' }, 'No failed payments. Pick a scenario on the payment provider panel to send one.'),
    );
    return;
  }
  // Open alerts first, newest first within each group.
  const sorted = [...alerts].sort(
    (x, y) => Number(x.status === 'recovered') - Number(y.status === 'recovered') || y.raisedAtMs - x.raisedAtMs,
  );
  container.replaceChildren(...sorted.map(alertCard));
}

export function renderCounters(alerts: Alert[], log: LogEntry[]): void {
  const count = (o: LogOutcome) => log.filter((l) => l.outcome === o).length;
  const items: [string, number, string][] = [
    ['Needs action', alerts.filter((a) => a.status === 'open').length, 'open'],
    ['Recovered', alerts.filter((a) => a.status === 'recovered').length, 'recovered'],
    ['Fake notifications rejected', count('rejected'), 'rejected'],
    ['Repeats ignored', count('duplicate'), 'duplicate'],
  ];
  byId('counters').replaceChildren(
    ...items.map(([label, n, key]) =>
      h('div', { class: 'counter', 'data-testid': `count-${key}` }, h('dt', {}, label), h('dd', {}, String(n))),
    ),
  );
}

export function renderSlack(messages: SlackMessage[]): void {
  const container = byId('slack-messages');
  if (messages.length === 0) {
    container.replaceChildren(h('p', { class: 'empty' }, 'No messages yet. Alerts are posted here as they happen.'));
    return;
  }
  container.replaceChildren(
    ...[...messages].reverse().map((m) => {
      const [first = '', ...rest] = m.text.split('\n');
      return h('article', { class: 'slack-message', 'data-testid': 'slack-message' },
        h('p', { class: 'slack-author' }, 'Payment alerts bot ', h('time', {}, time(m.atMs))),
        h('p', { class: 'slack-first' }, first),
        ...rest.map((line) => h('p', { class: 'slack-line' }, line)),
        // Full text for tests and screen readers, identical to what Slack would receive.
        h('pre', { class: 'visually-hidden', 'data-testid': 'slack-text' }, m.text),
      );
    }),
  );
}

const OUTCOME_LABEL: Record<LogOutcome, string> = {
  alert_raised: 'Alert raised',
  alert_updated: 'Alert updated',
  alert_resolved: 'Recovered',
  duplicate: 'Repeat ignored',
  rejected: 'Rejected',
  ignored: 'Ignored',
  recorded: 'Recorded',
};

export function renderLog(log: LogEntry[], filter: string): void {
  const q = filter.trim().toLowerCase();
  const rows = [...log]
    .reverse()
    .filter((l) => !q || [l.orderId, l.eventId, l.paymentId].some((v) => v?.toLowerCase().includes(q)));
  const body = byId('log-body');
  if (rows.length === 0) {
    body.replaceChildren(
      h('tr', {}, h('td', { colspan: '5', class: 'empty' }, q ? `Nothing found for “${filter.trim()}”.` : 'No notifications received yet.')),
    );
    return;
  }
  body.replaceChildren(
    ...rows.map((l) =>
      h('tr', { 'data-testid': 'log-entry', 'data-outcome': l.outcome },
        h('td', { 'data-label': 'Time' }, time(l.atMs)),
        h('td', { 'data-label': 'Outcome' }, h('span', { class: `outcome outcome-${l.outcome}` }, OUTCOME_LABEL[l.outcome])),
        h('td', { 'data-label': 'Order' }, l.orderId ?? '–'),
        h('td', { 'data-label': 'Event ID', class: 'mono' }, l.eventId ?? '– (not trusted)'),
        h('td', { 'data-label': 'Detail', 'data-testid': 'log-detail' }, l.detail),
      ),
    ),
  );
}

export function renderOutbox(deliveries: Delivery[]): void {
  if (deliveries.length === 0) {
    byId('outbox-body').replaceChildren(h('p', { class: 'empty' }, 'Nothing sent yet.'));
    return;
  }
  byId('outbox-body').replaceChildren(
    ...deliveries.map((d, i) =>
      h('div', { class: 'outbox-item' },
        h('p', {}, deliveries.length > 1 ? `Notification ${i + 1} of ${deliveries.length}` : 'Notification'),
        h('pre', { class: 'mono' }, `POST /webhooks/payments\nStripe-Signature: ${d.headers['Stripe-Signature'] ?? ''}\n\n${JSON.stringify(JSON.parse(d.rawBody), null, 2)}`),
      ),
    ),
  );
}
