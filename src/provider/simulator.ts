// SIMULATED PAYMENT PROVIDER. Builds and signs Stripe-shaped webhook
// notifications from the scenario fixtures, the way a real provider would
// send them. No network, no accounts, no real money.
import s1 from '../../scenarios/fixtures/S1-card-declined.json';
import s2 from '../../scenarios/fixtures/S2-insufficient-funds.json';
import s3 from '../../scenarios/fixtures/S3-expired-card.json';
import s4 from '../../scenarios/fixtures/S4-fail-then-retry-succeeds.json';
import s5 from '../../scenarios/fixtures/S5-duplicate-event.json';
import s6 from '../../scenarios/fixtures/S6-invalid-signature.json';
import s7 from '../../scenarios/fixtures/S7-unknown-failure-reason.json';
import { DEMO_WEBHOOK_SECRET, WRONG_SECRET } from './config';
import { signatureHeader } from './signature';

interface FixtureEvent {
  id: string;
  created: number;
  data: { object: { id: string } & Record<string, unknown> };
  [key: string]: unknown;
}

export interface Scenario {
  id: string;
  title: string;
  button: string;
  description: string;
  deliveries: { signWith: 'demo' | 'wrong'; event: FixtureEvent }[];
}

export const SCENARIOS: Scenario[] = [s1, s2, s3, s4, s5, s6, s7] as Scenario[];

export interface Delivery {
  rawBody: string;
  headers: Record<string, string>;
}

/**
 * Each click in the control panel is a new run. Adding "_r<run>" to the IDs
 * makes every run a separate failure; deliveries inside one run (the S5
 * duplicate) keep identical IDs and bodies.
 */
export async function buildDeliveries(scenario: Scenario, options: { run: number; nowMs: number }): Promise<Delivery[]> {
  const now = Math.floor(options.nowMs / 1000);
  const suffix = `_r${options.run}`;
  return Promise.all(
    scenario.deliveries.map(async ({ signWith, event }) => {
      const live = {
        ...event,
        id: event.id + suffix,
        created: now,
        data: { ...event.data, object: { ...event.data.object, id: event.data.object.id + suffix } },
      };
      const rawBody = JSON.stringify(live);
      const secret = signWith === 'demo' ? DEMO_WEBHOOK_SECRET : WRONG_SECRET;
      return { rawBody, headers: { 'Stripe-Signature': await signatureHeader(secret, rawBody, now) } };
    }),
  );
}
