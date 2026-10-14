import '@fontsource/bricolage-grotesque/600.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { createIntegration } from './core/integration';
import type { Clock } from './core/types';
import { createStripeStyleAdapter } from './provider/adapter';
import { DEMO_WEBHOOK_SECRET } from './provider/config';
import { SCENARIOS, buildDeliveries, type Scenario } from './provider/simulator';
import { byId } from './ui/dom';
import { renderAlerts, renderCounters, renderLog, renderOutbox, renderScenarioButtons, renderSlack } from './ui/render';

/** Pause between notifications in one scenario, so each step is visible. */
const DELIVERY_GAP_MS = 400;

const clock: Clock = { nowMs: () => Date.now() };
const integration = createIntegration({
  adapter: createStripeStyleAdapter({ secret: DEMO_WEBHOOK_SECRET, clock }),
  clock,
});

const filterInput = byId<HTMLInputElement>('log-filter');
const announcer = byId('announcer');

function render() {
  const alerts = integration.getAlerts();
  const log = integration.getLog();
  renderAlerts(alerts);
  renderCounters(alerts, log);
  renderSlack(integration.getSlackMessages());
  renderLog(log, filterInput.value);
}

let run = 0;
let busy = false;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runScenario(scenario: Scenario) {
  if (busy) return;
  busy = true;
  setBusy(true);
  run += 1;
  try {
    const deliveries = await buildDeliveries(scenario, { run, nowMs: clock.nowMs() });
    renderOutbox(deliveries);
    for (const [i, delivery] of deliveries.entries()) {
      if (i > 0) await wait(DELIVERY_GAP_MS);
      const entry = await integration.receiveWebhook(delivery.rawBody, delivery.headers);
      announcer.textContent = entry.detail;
    }
    // On a phone the console is below the buttons: bring the result into view.
    if (window.matchMedia('(max-width: 899px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      byId('console').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  } finally {
    busy = false;
    setBusy(false);
  }
}

const buttons = renderScenarioButtons(SCENARIOS, (s) => void runScenario(s));
function setBusy(on: boolean) {
  for (const b of [...buttons, byId<HTMLButtonElement>('reset')]) b.disabled = on;
  byId('scenario-buttons').setAttribute('aria-busy', String(on));
}

byId('reset').addEventListener('click', () => {
  integration.reset();
  filterInput.value = '';
  renderOutbox([]);
  announcer.textContent = 'Demo reset.';
});
filterInput.addEventListener('input', () => renderLog(integration.getLog(), filterInput.value));

integration.subscribe(render);
render();
