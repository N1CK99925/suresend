import React, { useState, useEffect } from "react";
import ConnectWallet from "./components/ConnectWallet.jsx";
import SenderFlow from "./components/SenderFlow.jsx";
import RecipientView from "./components/RecipientView.jsx";
import MerchantDashboard from "./components/MerchantDashboard.jsx";
import FeedbackWidget from "./components/FeedbackWidget.jsx";
import { getAllFeedback, DEMO_MODE } from "./lib/stellar.js";

const TABS = [
  { id: "send", label: "Send" },
  { id: "recipient", label: "Recipient view" },
  { id: "merchant", label: "Merchant inbox" },
  { id: "pilot", label: "Pilot stats" },
];

export default function App() {
  const [address, setAddress] = useState(localStorage.getItem("suresend_active_address") || "");
  const [tab, setTab] = useState("send");

  function handleConnected(addr) {
    setAddress(addr);
    localStorage.setItem("suresend_active_address", addr);
  }

  function handleDisconnected() {
    setAddress("");
    // localStorage key is cleared by disconnectWallet() in stellar.js
  }

  return (
    <div className="min-h-screen flex flex-col">
      {DEMO_MODE && (
        <div className="bg-seal-brass/10 border-b border-seal-brass/30 text-seal-brassDark text-xs sm:text-sm text-center py-1.5 px-4">
          Demo mode — wallet and locks are simulated locally. See docs/DEPLOYMENT.md to switch to a live testnet
          contract.
        </div>
      )}

      <header className="border-b border-ledger-line bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-xl tracking-tight">SureSend</p>
            <p className="text-xs text-ledger-mute -mt-0.5">Remittances with a destination</p>
          </div>
          <ConnectWallet address={address} onConnected={handleConnected} onDisconnected={handleDisconnected} />
        </div>
        <nav className="mx-auto max-w-5xl px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-seal-brass text-ledger-ink"
                  : "border-transparent text-ledger-mute hover:text-ledger-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
        {tab === "send" && <SenderFlow address={address} />}
        {tab === "recipient" && <RecipientView address={address} />}
        {tab === "merchant" && <MerchantDashboard address={address} />}
        {tab === "pilot" && <PilotStats />}
      </main>

      <footer className="text-center text-xs text-ledger-mute py-6">
        SureSend — built on Stellar. Locked funds only ever move to a whitelisted merchant anchor or back to the
        sender.
      </footer>

      <FeedbackWidget address={address} />
    </div>
  );
}

function PilotStats() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getAllFeedback()
      .then((data) => {
        if (!mounted) return;
        setFeedback(data || []);
      })
      .catch(() => {
        if (!mounted) return;
        setFeedback([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const avg = feedback.length ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1) : "—";

  return (
    <div>
      <h2 className="font-display font-semibold text-lg mb-1">Pilot feedback</h2>
      <p className="text-sm text-ledger-mute mb-6">
        Aggregated from the in-app feedback widget. Export this alongside your submission's user feedback summary.
      </p>
      <div className="mb-4">
        <button
          onClick={() => {
            const data = JSON.stringify(feedback, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `suresend-feedback-${new Date().toISOString()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}
          className="rounded-stamp border border-ledger-line px-3 py-2 text-sm mr-2"
        >
          Export feedback
        </button>
        <button
          onClick={() => {
            navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(feedback, null, 2));
            alert('Feedback copied to clipboard');
          }}
          className="rounded-stamp border border-ledger-line px-3 py-2 text-sm"
        >
          Copy to clipboard
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <Stat label="Responses" value={feedback.length} />
        <Stat label="Avg. clarity rating" value={avg} />
        <Stat
          label="Roles represented"
          value={new Set(feedback.map((f) => f.role)).size}
        />
      </div>
      {feedback.length === 0 ? (
        <p className="text-sm text-ledger-mute">No feedback submitted yet in this browser.</p>
      ) : (
        <ul className="grid gap-2">
          {feedback
            .slice()
            .reverse()
            .map((f, i) => (
              <li key={i} className="rounded-stamp border border-ledger-line bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{f.role}</span>
                  <span className="font-display text-seal-brassDark">{f.rating}/5</span>
                </div>
                {f.comment && <p className="text-ledger-mute mt-1">{f.comment}</p>}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-stamp border border-ledger-line bg-white p-4">
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-xs text-ledger-mute mt-0.5">{label}</p>
    </div>
  );
}
