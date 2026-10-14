# CLAUDE.md

Customer proof of concept kit: failed-payment alerts for a fictional customer
(Kiezkaffee) with a simulated, Stripe-style payment provider. Runs entirely in the
browser on GitHub Pages.

- `scenarios/EXPECTED.md` is the source of truth. Never change it to match the code
  unless the expected value is shown to be wrong. `expected.json` must stay in sync
  (a unit test checks this).
- Everything provider-specific stays in `src/provider/`. `src/core/` must not import it.
- Never put customer personal data in Slack messages or the log.
- Label the customer "fictional" and the provider "simulated" wherever they appear.
- Before pushing, run `npm run check`. Never skip or weaken a test.
- The owner is not a developer: explain in plain language and offer multiple-choice options.
