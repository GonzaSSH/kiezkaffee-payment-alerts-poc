// The swap boundary is a rule, so it is tested: provider-neutral code in
// src/core/ must never import from src/provider/.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const coreDir = new URL('../../src/core/', import.meta.url);

describe('swap boundary', () => {
  for (const file of readdirSync(coreDir).filter((f) => f.endsWith('.ts'))) {
    it(`src/core/${file} does not depend on the payment provider`, () => {
      const source = readFileSync(new URL(file, coreDir), 'utf8');
      expect(source).not.toMatch(/from\s+['"][^'"]*provider/);
      expect(source.toLowerCase()).not.toContain('stripe');
    });
  }
});
