// The swap boundary is a rule, so it is tested. Outside src/provider/:
// - nothing mentions Stripe,
// - src/core/ and src/ui/ never import provider code,
// - src/main.ts imports the provider only through src/provider/index.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = new URL('../../src/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, src), 'utf8');
const tsFiles = (dir: string) =>
  readdirSync(new URL(dir, src))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `${dir}${f}`);

describe('swap boundary', () => {
  for (const file of [...tsFiles('core/'), ...tsFiles('ui/')]) {
    it(`src/${file} does not depend on the payment provider`, () => {
      const source = read(file);
      // Catches `import x from '...provider'`, `import '...provider'` and `import('...provider')`.
      expect(source).not.toMatch(/(?:from|import)\s*\(?\s*['"][^'"]*provider/);
      expect(source.toLowerCase()).not.toContain('stripe');
    });
  }

  it('src/main.ts only uses the provider through its index', () => {
    const source = read('main.ts');
    expect(source).not.toMatch(/(?:from|import)\s*\(?\s*['"]\.\/provider\/[^'"]+['"]/);
    expect(source).toMatch(/from\s+['"]\.\/provider['"]/);
    expect(source.toLowerCase()).not.toContain('stripe');
  });
});
