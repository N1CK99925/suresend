import React, { useState } from "react";
import { connectWallet, disconnectWallet, DEMO_MODE } from "../lib/stellar.js";
import { track, EVENTS } from "../lib/analytics.js";

export default function ConnectWallet({ address, onConnected, onDisconnected }) {
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

  async function handleSwitch() {
    // 1. Clear stored address so the app resets to disconnected state
    disconnectWallet();
    onDisconnected();

    // 2. Immediately open the connect modal so user can pick the new account
    setBusy(true);
    setError("");
    try {
      const addr = await connectWallet();
      onConnected(addr);
      track(EVENTS.WALLET_CONNECTED, { demo: DEMO_MODE });
    } catch (err) {
      // If user cancels the modal that's fine — they're already disconnected
      // and can click "Connect wallet" again manually.
      if (err?.message && !err.message.toLowerCase().includes("cancel")) {
        setError(err?.message || "Couldn't connect. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    disconnectWallet();
    onDisconnected();
    setError("");
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-stamp border border-ledger-line bg-white px-3 py-1.5 text-sm font-display">
          <span className="h-2 w-2 rounded-full bg-route-green" aria-hidden />
          <span className="text-ledger-ink">
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
          {DEMO_MODE && <span className="text-ledger-mute text-xs">(demo)</span>}
        </div>
        <button
          onClick={handleSwitch}
          disabled={busy}
          title="Switch to a different Stellar account"
          className="rounded-stamp border border-ledger-line bg-white px-3 py-1.5 text-xs font-medium text-ledger-mute hover:text-ledger-ink hover:border-ledger-slate transition-colors disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Switch"}
        </button>
        <button
          onClick={handleDisconnect}
          title="Disconnect wallet"
          className="rounded-stamp border border-ledger-line bg-white px-2 py-1.5 text-xs font-medium text-ledger-mute hover:text-route-red hover:border-route-red/40 transition-colors"
        >
          ✕
        </button>
        {error && (
          <p className="absolute top-14 right-4 text-xs text-route-red bg-white border border-route-red/30 rounded-stamp px-2 py-1 z-10">
            {error}
          </p>
        )}
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
