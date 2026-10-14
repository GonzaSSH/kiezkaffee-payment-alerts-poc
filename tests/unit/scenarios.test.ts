// Every scenario S1-S7 must match scenarios/expected.json exactly.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import expected from '../../scenarios/expected.json';
import { SCENARIOS, buildDeliveries } from '../../src/provider/simulator';
import { FIXED_NOW_MS, fixedClock, newIntegration } from './helpers';

type Expected = (typeof expected)['S1'];
const EXPECTED = expected as Record<string, Expected>;

async function runScenario(id: string) {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) throw new Error(`no scenario ${id}`);
  const clock = fixedClock();
  const integration = newIntegration(clock);
  for (const delivery of await buildDeliveries(scenario, { run: 1, nowMs: FIXED_NOW_MS })) {
    clock.advance(250); // a little network delay between provider and integration
    await integration.receiveWebhook(delivery.rawBody, delivery.headers);
  }
  return integration;
}

describe('scenarios match EXPECTED.md / expected.json', () => {
  it('has exactly the seven planned scenarios', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
    expect(Object.keys(EXPECTED).sort()).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
  });

  for (const id of Object.keys(EXPECTED)) {
    describe(id, () => {
      const want = EXPECTED[id]!;

      it('raises exactly the expected alerts', async () => {
        const integration = await runScenario(id);
        const got = integration.getAlerts().map((a) => ({
          orderId: a.orderId,
          amount: a.amount,
          maskedEmail: a.maskedEmail,
          title: a.title,
          explanation: a.explanation,
          nextStep: a.nextStep,
          status: a.status,
        }));
        expect(got).toEqual(want.alerts);
      });

      it('posts exactly the expected Slack messages', async () => {
        const integration = await runScenario(id);
        expect(integration.getSlackMessages().map((m) => m.text)).toEqual(want.slack);
      });

      it('writes exactly the expected log lines', async () => {
        const integration = await runScenario(id);
        const got = integration.getLog().map((e) => ({
          outcome: e.outcome,
          eventId: e.eventId,
          orderId: e.orderId,
          detail: e.detail,
        }));
        expect(got).toEqual(want.log);
      });

      it('alerts within 60 seconds of the event being created', async () => {
        const integration = await runScenario(id);
        for (const alert of integration.getAlerts()) {
          expect(alert.timeToAlertMs).toBeGreaterThanOrEqual(0);
          expect(alert.timeToAlertMs).toBeLessThanOrEqual(60_000);
        }
      });
    });
  }
});

describe('EXPECTED.md and expected.json agree', () => {
  const markdown = readFileSync(new URL('../../scenarios/EXPECTED.md', import.meta.url), 'utf8');

  for (const [id, want] of Object.entries(EXPECTED)) {
    it(`${id}: every expected text appears in EXPECTED.md`, () => {
      const section = markdown.split(`## ${id}:`)[1]?.split('\n## ')[0];
      expect(section, `section for ${id}`).toBeDefined();
      for (const a of want.alerts) {
        for (const value of [a.orderId, a.amount, a.maskedEmail, a.title, a.explanation, a.nextStep]) {
          expect(section).toContain(value);
        }
      }
      for (const text of want.slack) expect(section).toContain('```\n' + text + '\n```');
      for (const l of want.log) {
        expect(section).toContain(`| ${l.outcome} | ${l.eventId ?? '–'} | ${l.orderId ?? '–'} | ${l.detail} |`);
      }
    });
  }
});
