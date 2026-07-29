# Analytics & monitoring

## Product analytics: Plausible

Chosen over GA/PostHog for the MVP because SureSend handles family
financial data and remittance-purpose metadata — a cookie-free,
no-personal-data tool is an easier trust story for a pilot with real
families, and Plausible's event API is a single script tag.

Setup:

1. Create a site at https://plausible.io (or self-host).
2. Set `VITE_PLAUSIBLE_DOMAIN` in `frontend/.env` to your site's
   domain.
3. Events already instrumented in `src/lib/analytics.js` /
   `EVENTS`, fired from the relevant components:
   - `wallet_connected`
   - `lock_created`
   - `delivery_attested`
   - `lock_claimed`
   - `feedback_submitted`

This gives you the exact funnel the submission asks for: connect →
lock → attest → claim, plus drop-off at each step.

## Error tracking: Sentry (recommended, not wired up yet)

Not included in this scaffold to avoid bundling a DSN placeholder
that silently fails. To add:

```bash
npm install @sentry/react
```

```js
// src/main.jsx, before ReactDOM.createRoot
import * as Sentry from "@sentry/react";
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.2 });
```

Wrap `<App />` in `<Sentry.ErrorBoundary fallback={...}>` for a
production-safe error boundary.

## Contract-side monitoring

The contract emits events on every state transition
(`created`, `attested`, `claimed`, `expired` — see
`contracts/suresend/src/lib.rs`). Point a small script or
[Stellar Expert](https://stellar.expert)'s contract event explorer at
your `CONTRACT_ID` to watch these live during the pilot without
building a custom indexer yet.
