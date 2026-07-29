import React, { useState } from "react";
import { connectWallet, DEMO_MODE } from "../lib/stellar.js";
import { track, EVENTS } from "../lib/analytics.js";

export default function ConnectWallet({ address, onConnected }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setBusy(true);
    setError("");
    try {
      const addr = await connectWallet();
      onConnected(addr);
      track(EVENTS.WALLET_CONNECTED, { demo: DEMO_MODE });
    } catch (err) {
      setError(err?.message || "Couldn't connect a wallet. Is Freighter installed?");
    } finally {
      setBusy(false);
    }
  }

  if (address) {
    return (
      <div className="flex items-center gap-2 rounded-stamp border border-ledger-line bg-white px-3 py-1.5 text-sm font-display">
        <span className="h-2 w-2 rounded-full bg-route-green" aria-hidden />
        <span className="text-ledger-ink">
          {address.slice(0, 4)}…{address.slice(-4)}
        </span>
        {DEMO_MODE && <span className="text-ledger-mute text-xs">(demo)</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConnect}
        disabled={busy}
        className="rounded-stamp bg-ledger-ink text-white px-4 py-2 text-sm font-medium font-display hover:bg-ledger-slate transition-colors disabled:opacity-60"
      >
        {busy ? "Connecting…" : "Connect wallet"}
      </button>
      {error && <p className="text-xs text-route-red max-w-[220px] text-right">{error}</p>}
    </div>
  );
}
