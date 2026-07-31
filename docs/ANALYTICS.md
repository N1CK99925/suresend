# Analytics & monitoring

Monitoring for the SureSend pilot is split into three distinct layers:

- **A. Production traffic analytics** — Netlify Web Analytics on the live
  deployment (pageviews, unique visitors, bandwidth/traffic trends).
- **B. Application-level events** — frontend instrumentation of the
  product funnel (connect → lock → attest → claim → feedback).
- **C. Pilot Stats** — aggregation of user feedback submitted through the
  in-app feedback widget.

## A. Production traffic analytics: Netlify Web Analytics

The production deployment (https://suresend.netlify.app) uses
**Netlify Web Analytics** to monitor site traffic:

- **pageviews**
- **unique visitors**
- **bandwidth/traffic trends**

Netlify Web Analytics is script-based and privacy-friendly (no cookie
banner required), and it is configured per-site in the Netlify dashboard
rather than in the repo — it injects its own script into the deployed
site.

Evidence:

- [`docs/screenshots/analytics.png`](screenshots/analytics.png) — the
  production Netlify Web Analytics dashboard showing traffic, pageviews,
  and unique visitors for the deployed app.

## B. Application-level product/funnel events

The frontend instruments product events (not traffic) for the core
funnel. The canonical event names live in one place —
`frontend/src/lib/analytics.js` (`EVENTS`) — and are fired from the
relevant components:

| Event | Where it's fired |
|---|---|
| `wallet_connected` | `frontend/src/components/ConnectWallet.jsx` |
| `lock_created` | `frontend/src/components/SenderFlow.jsx` |
| `delivery_attested` | `frontend/src/components/MerchantDashboard.jsx` |
| `lock_claimed` | `frontend/src/components/MerchantDashboard.jsx` |
| `feedback_submitted` | `frontend/src/components/FeedbackWidget.jsx` |

How the instrumentation works: `initAnalytics()` in
`frontend/src/lib/analytics.js` loads an analytics script only when an
analytics domain is configured via `VITE_PLAUSIBLE_DOMAIN`, and `track()`
forwards each event to that provider's browser global (e.g.
`window.plausible`) when one is present at runtime; otherwise it logs the
event to the browser console in development.

These events are the product/funnel instrumentation layer. They are
distinct from Netlify Web Analytics (traffic) and are not currently
reported to any third-party analytics service by the production build —
the production evidence is the Netlify Web Analytics traffic dashboard.

## C. Pilot feedback: Pilot Stats

Feedback submitted through the in-app feedback widget
(`frontend/src/components/FeedbackWidget.jsx`) is aggregated separately in
the in-app **Pilot stats** view (`frontend/src/App.jsx` — `PilotStats`).

Current pilot evidence:

- **11 responses**
- **4.3/5 average clarity rating**
- **2 roles represented**

Evidence:

- [`docs/screenshots/pilot-stats.png`](screenshots/pilot-stats.png) — the
  in-app Pilot Stats view aggregating the pilot feedback.

## Contract-side monitoring

The contract emits events on every state transition (`created`,
`attested`, `claimed`, `expired` — see
`contracts/suresend/src/lib.rs`). Point a small script or
[Stellar Expert](https://stellar.expert)'s contract event explorer at
your `CONTRACT_ID` to watch these live during the pilot without building
a custom indexer yet.

## Error tracking: Sentry (optional / future)

Sentry is **not** part of the current production setup — there is no
Sentry DSN, no `@sentry/react` dependency, and no production evidence of
error-tracking events. It is only a recommended future improvement if
error monitoring is added later:

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
