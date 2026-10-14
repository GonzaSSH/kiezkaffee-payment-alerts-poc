import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from /<repo-name>/.
export default defineConfig({
  base: '/kiezkaffee-payment-alerts-poc/',
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
