import { createIntegration } from '../../src/core/integration';
import { createStripeStyleAdapter } from '../../src/provider/adapter';
import { DEMO_WEBHOOK_SECRET } from '../../src/provider/config';
import type { Clock } from '../../src/core/types';

/** The fixtures' placeholder "created" time, in milliseconds. */
export const FIXED_NOW_MS = 1_791_972_000_000;

export function fixedClock(startMs = FIXED_NOW_MS): Clock & { advance(ms: number): void } {
  let now = startMs;
  return {
    nowMs: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

export function newIntegration(clock: Clock = fixedClock()) {
  const adapter = createStripeStyleAdapter({ secret: DEMO_WEBHOOK_SECRET, clock });
  return createIntegration({ adapter, clock });
}
