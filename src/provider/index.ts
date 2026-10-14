// The only door into src/provider/. The rest of the app imports from here and
// never from the files behind it, so nothing outside this folder knows which
// payment provider (or simulator) is in use.
import type { Clock, PaymentProviderAdapter } from '../core/types';
import { createStripeStyleAdapter } from './adapter';
import { DEMO_WEBHOOK_SECRET } from './config';
import { SCENARIOS, buildDeliveries, type Delivery } from './simulator';

/** The adapter the integration uses. Swap the provider here. */
export function createProviderAdapter(clock: Clock): PaymentProviderAdapter {
  return createStripeStyleAdapter({ secret: DEMO_WEBHOOK_SECRET, clock });
}

// --- Demo only: the simulated provider behind the control panel. A real
// deployment has no simulator; the control panel goes away with it. ---

export interface DemoScenario {
  id: string;
  button: string;
  description: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = SCENARIOS.map(({ id, button, description }) => ({ id, button, description }));

export type { Delivery };

/** Builds the signed notifications the simulated provider sends for one click. */
export function simulateScenario(id: string, options: { run: number; nowMs: number }): Promise<Delivery[]> {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) throw new Error(`Unknown scenario ${id}`);
  return buildDeliveries(scenario, options);
}

/** The notification as raw HTTP, for the "Last notification sent" panel. */
export function describeDelivery(delivery: Delivery): string {
  const headers = Object.entries(delivery.headers).map(([name, value]) => `${name}: ${value}`);
  const body = JSON.stringify(JSON.parse(delivery.rawBody), null, 2);
  return ['POST /webhooks/payments', ...headers, '', body].join('\n');
}
