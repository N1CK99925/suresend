// Minimal, privacy-respecting analytics wrapper.
//
// Default: Plausible (no cookies, GDPR-friendly, good fit for a
// remittance product handling sensitive family financial data).
// Swap the script tag / event call for PostHog or Umami if you
// prefer — see docs/ANALYTICS.md for setup + why this choice.

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN || "";

export function initAnalytics() {
  if (!PLAUSIBLE_DOMAIN || typeof document === "undefined") return;
  const script = document.createElement("script");
  script.defer = true;
  script.setAttribute("data-domain", PLAUSIBLE_DOMAIN);
  script.src = "https://plausible.io/js/script.js";
  document.head.appendChild(script);
}

export function track(eventName, props = {}) {
  if (typeof window === "undefined") return;
  if (window.plausible) {
    window.plausible(eventName, { props });
  } else if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[analytics:dev]", eventName, props);
  }
}

// Canonical event names kept in one place so the funnel is easy to
// audit: wallet connect -> lock created -> delivery attested -> claimed.
export const EVENTS = {
  WALLET_CONNECTED: "wallet_connected",
  LOCK_CREATED: "lock_created",
  DELIVERY_ATTESTED: "delivery_attested",
  LOCK_CLAIMED: "lock_claimed",
  FEEDBACK_SUBMITTED: "feedback_submitted",
};
