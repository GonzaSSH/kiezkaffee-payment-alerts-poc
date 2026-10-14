// Every scenario, triggered from the control panel, shows exactly what
// scenarios/EXPECTED.md says: alerts, Slack messages and log lines.
import { expect, test, type Page } from '@playwright/test';
import expected from '../../scenarios/expected.json' with { type: 'json' };

interface Expected {
  alerts: { orderId: string; amount: string; maskedEmail: string; title: string; explanation: string; nextStep: string; status: string }[];
  slack: string[];
  log: { outcome: string; eventId: string | null; orderId: string | null; detail: string }[];
}
const EXPECTED: Record<string, Expected> = expected;

async function trigger(page: Page, id: string) {
  await page.locator(`[data-scenario="${id}"]`).click();
  // Buttons are disabled while the simulated provider is sending.
  await expect(page.locator(`[data-scenario="${id}"]`)).toBeEnabled();
}

// Any JavaScript error on the page fails the test.
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('the page says the customer is fictional and the provider simulated', async ({ page }) => {
  await expect(page.getByText('Fictional customer', { exact: true })).toBeVisible();
  await expect(page.getByText('Simulated payment provider (Stripe-style)')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Payment provider/ })).toContainText('simulated');
  await expect(page.getByRole('heading', { name: /Slack/ })).toContainText('simulated');
});

test('starts empty', async ({ page }) => {
  await expect(page.getByTestId('alert')).toHaveCount(0);
  await expect(page.getByTestId('slack-message')).toHaveCount(0);
  await expect(page.getByTestId('log-entry')).toHaveCount(0);
});

for (const [id, want] of Object.entries(EXPECTED)) {
  test(`${id} shows the expected alert, Slack message and log`, async ({ page }) => {
    await trigger(page, id);

    // Alerts
    const alerts = page.getByTestId('alert');
    await expect(alerts).toHaveCount(want.alerts.length);
    for (const a of want.alerts) {
      const card = page.locator(`[data-testid="alert"][data-order="${a.orderId}"]`);
      await expect(card).toHaveAttribute('data-status', a.status);
      await expect(card).toContainText(a.amount);
      await expect(card.getByTestId('alert-title')).toHaveText(a.title);
      await expect(card.getByTestId('alert-explanation')).toHaveText(a.explanation);
      await expect(card.getByTestId('alert-email')).toHaveText(a.maskedEmail);
      if (a.status === 'open') {
        await expect(card.getByTestId('alert-next')).toHaveText(`Next step: ${a.nextStep}`);
      } else {
        await expect(card.getByTestId('alert-status')).toHaveText('Recovered');
      }
      const seconds = parseFloat((await card.getByTestId('time-to-alert').textContent()) ?? 'NaN');
      expect(seconds).toBeGreaterThanOrEqual(0);
      expect(seconds).toBeLessThan(60);
    }

    // Slack, shown newest first; compare in sending order
    const slack = await page.getByTestId('slack-text').allTextContents();
    expect(slack.reverse()).toEqual(want.slack);

    // Log, shown newest first; compare in arrival order
    const rows = page.getByTestId('log-entry');
    await expect(rows).toHaveCount(want.log.length);
    const outcomes = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-outcome')));
    const details = await page.getByTestId('log-detail').allTextContents();
    expect(outcomes.reverse()).toEqual(want.log.map((l) => l.outcome));
    expect(details.reverse()).toEqual(want.log.map((l) => l.detail));
  });
}

test('S5: the duplicate never alerts twice, even when clicked again', async ({ page }) => {
  await trigger(page, 'S5');
  await expect(page.getByTestId('alert')).toHaveCount(1);
  await expect(page.getByTestId('slack-message')).toHaveCount(1);
  await expect(page.getByTestId('count-duplicate')).toContainText('1');
  // A second click is a new failure (new run), with its own duplicate ignored.
  await trigger(page, 'S5');
  await expect(page.getByTestId('alert')).toHaveCount(2);
  await expect(page.getByTestId('slack-message')).toHaveCount(2);
  await expect(page.getByTestId('count-duplicate')).toContainText('2');
});

test('S6: an invalid signature is rejected and never alerts', async ({ page }) => {
  await trigger(page, 'S6');
  await expect(page.getByTestId('count-rejected')).toContainText('1');
  await expect(page.getByTestId('alert')).toHaveCount(0);
  await expect(page.getByTestId('slack-message')).toHaveCount(0);
  await expect(page.getByTestId('log-entry')).toHaveAttribute('data-outcome', 'rejected');
});

test('Slack never shows a customer email address', async ({ page }) => {
  for (const id of Object.keys(EXPECTED)) await trigger(page, id);
  for (const text of await page.getByTestId('slack-message').allTextContents()) {
    expect(text).not.toContain('@');
  }
});

test('support can trace one payment in the log by order number', async ({ page }) => {
  await trigger(page, 'S2');
  await trigger(page, 'S4');
  await page.getByLabel('Trace a payment').fill('KK-10424');
  const rows = page.getByTestId('log-entry');
  await expect(rows).toHaveCount(2);
  for (const order of await rows.locator('td[data-label="Order"]').allTextContents()) expect(order).toBe('KK-10424');
  await page.getByLabel('Trace a payment').fill('KK-99999');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Nothing found for “KK-99999”.')).toBeVisible();
});

test('the last notification sent shows the Stripe-style signature header', async ({ page }) => {
  await trigger(page, 'S1');
  await page.getByText('Last notification sent').click();
  await expect(page.locator('.outbox pre')).toContainText(/Stripe-Signature: t=\d+,v1=[0-9a-f]{64}/);
  await expect(page.locator('.outbox pre')).toContainText('"type": "payment_intent.payment_failed"');
});

test('reset clears everything', async ({ page }) => {
  await trigger(page, 'S1');
  await expect(page.getByTestId('alert')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByTestId('alert')).toHaveCount(0);
  await expect(page.getByTestId('slack-message')).toHaveCount(0);
  await expect(page.getByTestId('log-entry')).toHaveCount(0);
});

test('fits the screen without sideways scrolling', async ({ page }) => {
  for (const id of Object.keys(EXPECTED)) await trigger(page, id);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
