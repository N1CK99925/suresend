import React, { useEffect, useState } from "react";
import { getLocksFor, attestDelivery, claimLock } from "../lib/stellar.js";
import { track, EVENTS } from "../lib/analytics.js";
import { Spinner, EmptyState, StatusPill } from "./ui/Primitives.jsx";
import merchants from "../data/merchants.json";

export default function MerchantDashboard({ address }) {
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const merchantProfile = merchants.find((m) => m.address === address);

  async function refresh() {
    setLoading(true);
    const rows = await getLocksFor(address, "merchant");
    setLocks(rows);
    setLoading(false);
  }

  useEffect(() => {
    if (address) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (!address) {
    return (
      <EmptyState
        title="Connect the merchant's wallet"
        body="Use the demo address for Gharana Public School, Al-Shifa Pharmacy, or KESCO to see locks routed to that merchant."
      />
    );
  }

  async function handleAttest(id) {
    setBusyId(id);
    await attestDelivery(id);
    track(EVENTS.DELIVERY_ATTESTED, { lockId: id });
    await refresh();
    setBusyId(null);
  }

  async function handleClaim(id) {
    setBusyId(id);
    await claimLock(id);
    track(EVENTS.LOCK_CLAIMED, { lockId: id });
    await refresh();
    setBusyId(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display font-semibold text-lg">
          {merchantProfile ? merchantProfile.name : "Merchant inbox"}
        </h2>
        <p className="text-sm text-ledger-mute">
          Confirm the service or good was delivered, then claim settlement. Both steps are separate on purpose —
          it's the proof-of-delivery gate that keeps this from being a normal remittance with extra steps.
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading incoming locks…" />
      ) : locks.length === 0 ? (
        <EmptyState title="No locks routed here yet" body="Locks created by senders for this merchant will appear here." />
      ) : (
        <ul className="grid gap-3">
          {locks.map((l) => (
            <li key={l.id} className="rounded-stamp border border-ledger-line bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold capitalize">{l.category}</span>
                  <StatusPill status={l.status} />
                </div>
                <p className="text-sm text-ledger-mute mt-1">
                  {l.amount} USDC · from {l.sender.slice(0, 6)}…{l.sender.slice(-4)}
                </p>
              </div>
              <div className="flex gap-2">
                {l.status === "Locked" && (
                  <button
                    onClick={() => handleAttest(l.id)}
                    disabled={busyId === l.id}
                    className="rounded-stamp border border-seal-brass text-seal-brassDark px-3 py-1.5 text-sm font-medium hover:bg-seal-brass/5 disabled:opacity-50"
                  >
                    Confirm delivery
                  </button>
                )}
                {l.status === "DeliveryAttested" && (
                  <button
                    onClick={() => handleClaim(l.id)}
                    disabled={busyId === l.id}
                    className="rounded-stamp bg-route-green text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    Claim settlement
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
