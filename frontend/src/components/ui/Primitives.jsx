import React from "react";

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center gap-2 text-ledger-mute text-sm py-6" role="status">
      <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-ledger-line border-t-seal-brass animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="rounded-stamp border border-route-red/30 bg-route-red/5 px-4 py-3 text-sm text-route-red flex items-start justify-between gap-3">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 underline decoration-dotted underline-offset-4 font-medium"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="text-center py-12 px-4 border border-dashed border-ledger-line rounded-stamp">
      <p className="font-display font-semibold text-ledger-ink">{title}</p>
      <p className="text-sm text-ledger-mute mt-1 max-w-sm mx-auto">{body}</p>
      {action}
    </div>
  );
}

const STATUS_STYLES = {
  Locked: "bg-route-amber/10 text-route-amber border-route-amber/30",
  DeliveryAttested: "bg-seal-brass/10 text-seal-brassDark border-seal-brass/40",
  Claimed: "bg-route-green/10 text-route-green border-route-green/30",
  Refunded: "bg-ledger-mute/10 text-ledger-mute border-ledger-line",
  Released: "bg-ledger-mute/10 text-ledger-mute border-ledger-line",
};

const STATUS_LABELS = {
  Locked: "Locked",
  DeliveryAttested: "Delivery confirmed — awaiting settlement",
  Claimed: "Paid, confirmed",
  Refunded: "Refunded to sender",
  Released: "Released to recipient",
};

export function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-stamp border px-2 py-0.5 text-xs font-medium font-display tracking-wide ${
        STATUS_STYLES[status] || STATUS_STYLES.Locked
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
