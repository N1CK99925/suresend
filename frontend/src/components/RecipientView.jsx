import React, { useEffect, useState } from "react";
import { getLocksFor } from "../lib/stellar.js";
import { Spinner, EmptyState, StatusPill } from "./ui/Primitives.jsx";
import merchants from "../data/merchants.json";

export default function RecipientView({ address }) {
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    getLocksFor(address, "recipient")
      .then(setLocks)
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) {
    return (
      <EmptyState
        title="Connect the recipient's wallet"
        body="This is what a family member back home sees: what's earmarked, where it's redeemable, and whether it's been confirmed paid."
      />
    );
  }

  return (
    <div>
      <h2 className="font-display font-semibold text-lg mb-1">What's earmarked for you</h2>
      <p className="text-sm text-ledger-mute mb-6">
        This view is read-only on purpose — it's here so nobody has to take anyone's word for what was sent.
      </p>

      {loading ? (
        <Spinner label="Loading…" />
      ) : locks.length === 0 ? (
        <EmptyState title="Nothing earmarked yet" body="Locks a sender creates with you as the fallback recipient will show up here." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {locks.map((l, i) => {
            const merchant = merchants.find((m) => m.address === l.merchant);
            return (
              <li key={l.id ?? `lock-${i}`} className="tear-edge rounded-stamp border border-ledger-line bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold capitalize">{l.category}</span>
                  <StatusPill status={l.status} />
                </div>
                <p className="text-sm mt-2">
                  <span className="font-medium">{l.amount} SUSD</span> — redeemable at{" "}
                  <span className="font-medium">{merchant?.name || "an approved merchant"}</span>
                </p>
                {l.status === "Claimed" && (
                  <p className="text-xs text-route-green mt-1 font-display">✓ Paid, confirmed</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
