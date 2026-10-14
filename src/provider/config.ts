// SIMULATED. These secrets exist only for the browser demo. In a real
// deployment the webhook secret lives in the server's secret store and never
// reaches a browser.

/** The secret the simulated provider and the integration share. */
export const DEMO_WEBHOOK_SECRET = 'whsec_demo_kiezkaffee_not_a_real_secret';

/** What an attacker might sign with (scenario S6). */
export const WRONG_SECRET = 'whsec_attacker_guess';

/** Stripe's header name. HTTP header names are case-insensitive. */
export const SIGNATURE_HEADER = 'stripe-signature';
