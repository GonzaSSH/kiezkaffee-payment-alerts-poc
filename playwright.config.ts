import { defineConfig, devices } from '@playwright/test';

// BASE_URL lets the same tests run against the live GitHub Pages demo.
const baseURL = process.env.BASE_URL ?? 'http://localhost:4173/kiezkaffee-payment-alerts-poc/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run preview', url: baseURL, reuseExistingServer: !process.env.CI },
});
