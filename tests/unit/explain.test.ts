import { describe, expect, it } from 'vitest';
import { explain } from '../../src/core/explain';
import { formatAmount, maskEmail } from '../../src/core/format';
import type { FailureReason } from '../../src/core/types';

const ALL: FailureReason[] = [
  'declined',
  'insufficient_funds',
  'expired_card',
  'incorrect_cvc',
  'lost_or_stolen',
  'processing_error',
  'too_many_attempts',
  'unknown',
];

describe('explain', () => {
  it.each(ALL)('%s has a title, a plain-language explanation and a next step', (reason) => {
    const e = explain(reason, 'code_x');
    expect(e.title.length).toBeGreaterThan(3);
    expect(e.explanation).toMatch(/\.$/);
    expect(e.nextStep).toMatch(/\.$/);
    // Plain language: the explanation never shows a raw code, except for unknown reasons.
    if (reason !== 'unknown') expect(e.explanation).not.toContain('_');
  });

  it('names the raw code for unknown reasons, so support can look it up', () => {
    expect(explain('unknown', 'brand_new_code').explanation).toBe(
      "The payment provider gave a reason we don't recognise (brand_new_code).",
    );
  });

  it('never tells support to reveal that a card was reported lost or stolen', () => {
    const e = explain('lost_or_stolen', 'stolen_card');
    expect(e.nextStep.toLowerCase()).toContain('do not mention');
  });
});

describe('formatAmount', () => {
  it.each([
    [3200, 'eur', '€32.00'],
    [5450, 'eur', '€54.50'],
    [5, 'eur', '€0.05'],
    [0, 'eur', '€0.00'],
    [1999, 'usd', '19.99 USD'],
  ])('%i %s → %s', (minor, currency, want) => {
    expect(formatAmount(minor, currency)).toBe(want);
  });
});

describe('maskEmail', () => {
  it.each([
    ['jana.m@example.com', 'j•••@example.com'],
    ['a@b.de', 'a•••@b.de'],
    ['not-an-email', '•••'],
    [null, null],
  ])('%s → %s', (input, want) => {
    expect(maskEmail(input)).toBe(want);
  });
});
