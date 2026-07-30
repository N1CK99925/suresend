import React, { useEffect, useState } from "react";
import merchants from "../data/merchants.json";
import {
  createLock,
  getLocksFor,
  trustSUSD,
  approveSUSD,
  getSUSDBalance,
} from "../lib/stellar.js";
import { track, EVENTS } from "../lib/analytics.js";
import { Spinner, ErrorBanner, EmptyState, StatusPill } from "./ui/Primitives.jsx";

const CATEGORIES = [
  { id: "school", label: "School fees", hint: "Tuition, exam fees, supplies" },
  { id: "medicine", label: "Medicine", hint: "Prescriptions, clinic visits" },
  { id: "utility", label: "Utilities", hint: "Electricity, water, gas" },
];

const STEPS = ["Category", "Merchant", "Amount", "Fallback", "Review"];

export default function SenderFlow({ address }) {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [timeoutDays, setTimeoutDays] = useState(30);
  const [onTimeout, setOnTimeout] = useState("RefundToSender");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [locks, setLocks] = useState([]);
  const [loadingLocks, setLoadingLocks] = useState(true);
  const [susdBalance, setSusdBalance] = useState(null);

  useEffect(() => {
    if (!address) return;
    setLoadingLocks(true);
    getLocksFor(address, "sender")
      .then(setLocks)
      .finally(() => setLoadingLocks(false));
  }, [address, submitting]);

  useEffect(() => {
    if (!address) return;
    let mounted = true;
    setSusdBalance(null);
    getSUSDBalance(address)
      .then((b) => {
        if (!mounted) return;
        setSusdBalance(Number(b) / 10_000_000);
      })
      .catch(() => {
        if (!mounted) return;
        setSusdBalance(null);
      });
    return () => {
      mounted = false;
    };
  }, [address, submitting]);

  const filteredMerchants = merchants.filter((m) => m.category === category);

  function reset() {
    setStep(0);
    setCategory(null);
    setMerchant(null);
    setAmount("");
    setRecipient("");
    setTimeoutDays(30);
    setOnTimeout("RefundToSender");
  }
  async function handleTrustSUSD() {
  setSubmitting(true);
  setError("");

  try {
    await trustSUSD(address);
    alert("SUSD enabled successfully! You can now receive and use SUSD.");
  } catch (err) {
    setError(
      err?.message ||
        "Couldn't enable SUSD for this wallet."
    );
  } finally {
    setSubmitting(false);
  }
}
async function handleApproveSUSD() {
  setSubmitting(true);
  setError("");

  try {
    await approveSUSD(address);
    alert("SUSD approved successfully!");
  } catch (err) {
    setError(
      err?.message ||
        "Couldn't approve SUSD for SureSend."
    );
  } finally {
    setSubmitting(false);
  }
}
  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      // Check SUSD balance first to provide a clearer error
      const numericAmount = Number(amount);
      const stroops = BigInt(Math.round(numericAmount * 10_000_000));
      const bal = await getSUSDBalance(address);

      // Debug logging to help diagnose persistent host errors
      console.debug("createLock: requested stroops=", String(stroops), "balance=", String(bal));

      if (bal < stroops) {
        const humanBal = Number(bal) / 10_000_000;
        setError(
          `Insufficient SUSD balance (${humanBal} SUSD). Please top up your wallet before locking funds.`
        );
        return;
      }

      await createLock({
        sender: address,
        recipient: recipient || address,
        merchant: merchant.address,
        amount,
        category,
        timeoutDays,
        onTimeout,
      });
      track(EVENTS.LOCK_CREATED, { category, timeoutDays });
      reset();
    } catch (err) {
      // Friendly handling for the common token transfer host error
      const msg = err?.message || err?.toString?.() || "Couldn't create the lock. Please try again.";
      console.error("createLock failed:", msg, err);

      if (typeof msg === "string" && msg.includes("resulting balance is not within the allowed range")) {
        setError(
          "Token transfer failed: your wallet balance or token constraints prevented the transfer. Verify you have enough SUSD and the asset trustline is established."
        );
      } else if (typeof msg === "string" && msg.includes("transaction failed")) {
        setError("Transaction failed. Check wallet/network and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!address) {
    return (
      <EmptyState
        title="Connect a wallet to send"
        body="Sending a purpose-locked payment requires signing the lock transaction from your own wallet."
      />
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-display text-ledger-mute mb-6">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={i === step ? "text-ledger-ink font-semibold" : i < step ? "text-route-green" : ""}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onRetry={handleSubmit} />
          </div>
        )}

        {step === 0 && (
          <StepCard title="What is this payment for?">
            <div className="grid gap-3 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCategory(c.id);
                    setMerchant(null);
                    setStep(1);
                  }}
                  className={`text-left rounded-stamp border p-4 transition-colors hover:border-seal-brass ${
                    category === c.id ? "border-seal-brass bg-seal-brass/5" : "border-ledger-line bg-white"
                  }`}
                >
                  <p className="font-display font-semibold">{c.label}</p>
                  <p className="text-xs text-ledger-mute mt-1">{c.hint}</p>
                </button>
              ))}
            </div>
          </StepCard>
        )}

        {step === 1 && (
          <StepCard title="Which merchant should be able to redeem it?" onBack={() => setStep(0)}>
            {filteredMerchants.length === 0 ? (
              <EmptyState
                title="No approved merchants yet in this category"
                body="During the pilot, merchants are whitelisted manually. Ask your pilot partner to reach out for onboarding."
              />
            ) : (
              <div className="grid gap-3">
                {filteredMerchants.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMerchant(m);
                      setStep(2);
                    }}
                    className={`text-left rounded-stamp border p-4 hover:border-seal-brass transition-colors ${
                      merchant?.id === m.id ? "border-seal-brass bg-seal-brass/5" : "border-ledger-line bg-white"
                    }`}
                  >
                    <p className="font-display font-semibold">{m.name}</p>
                    <p className="text-xs text-ledger-mute">{m.location}</p>
                    <p className="text-xs text-ledger-mute mt-1">{m.note}</p>
                  </button>
                ))}
              </div>
            )}
          </StepCard>
        )}

        {step === 2 && (
          <StepCard title="Amount and recipient" onBack={() => setStep(1)}>
            <div className="grid gap-4 max-w-sm">
              <label className="text-sm font-medium">
                Amount (SUSD)
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-stamp border border-ledger-line px-3 py-2 focus:border-seal-brass"
                  placeholder="150"
                />
              </label>
              <label className="text-sm font-medium">
                Recipient's Stellar address <span className="text-ledger-mute font-normal">(optional)</span>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="mt-1 w-full rounded-stamp border border-ledger-line px-3 py-2 focus:border-seal-brass font-mono text-sm"
                  placeholder="G… (defaults to your own address)"
                />
                <span className="block text-xs text-ledger-mute mt-1">
                  Only used if the lock times out and you choose "release to recipient" below.
                </span>
              </label>
              <button
                disabled={!amount || Number(amount) <= 0}
                onClick={() => setStep(3)}
                className="rounded-stamp bg-ledger-ink text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </StepCard>
        )}

        {step === 3 && (
          <StepCard title="If nobody redeems it in time…" onBack={() => setStep(2)}>
            <div className="grid gap-3 max-w-sm">
              <label className="text-sm font-medium">
                Timeout window (days)
                <input
                  type="number"
                  min="1"
                  value={timeoutDays}
                  onChange={(e) => setTimeoutDays(e.target.value)}
                  className="mt-1 w-full rounded-stamp border border-ledger-line px-3 py-2 focus:border-seal-brass"
                />
              </label>
              <div className="grid gap-2">
                <FallbackOption
                  selected={onTimeout === "RefundToSender"}
                  onClick={() => setOnTimeout("RefundToSender")}
                  title="Refund to me"
                  body="Money comes back to your wallet if it's never redeemed."
                />
                <FallbackOption
                  selected={onTimeout === "ReleaseToRecipient"}
                  onClick={() => setOnTimeout("ReleaseToRecipient")}
                  title="Release to recipient's general wallet"
                  body="If the merchant never confirms delivery, hand it over unrestricted instead of clawing it back."
                />
              </div>
              <button
                onClick={() => setStep(4)}
                className="rounded-stamp bg-ledger-ink text-white px-4 py-2 text-sm font-medium mt-2"
              >
                Review
              </button>
            </div>
          </StepCard>
        )}

        {step === 4 && (
          <StepCard title="Review and sign" onBack={() => setStep(3)}>
          <button
  onClick={handleTrustSUSD}
  disabled={submitting}
  className="mb-5 rounded-stamp border border-seal-brass text-seal-brassDark px-4 py-2 text-sm font-medium disabled:opacity-50"
>
  {submitting ? "Enabling SUSD…" : "Enable SUSD for this wallet"}
</button>
<button
  onClick={handleApproveSUSD}
  disabled={submitting}
  className="mb-5 ml-2 rounded-stamp border border-seal-brass text-seal-brassDark px-4 py-2 text-sm font-medium disabled:opacity-50"
>
  {submitting ? "Approving…" : "Approve SUSD for SureSend"}
</button>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm max-w-md">
              <dt className="text-ledger-mute">Category</dt>
              <dd className="font-medium capitalize">{category}</dd>
              <dt className="text-ledger-mute">Merchant</dt>
              <dd className="font-medium">{merchant?.name}</dd>
              <dt className="text-ledger-mute">Amount</dt>
              <dd className="font-medium">{amount} SUSD</dd>
              <dt className="text-ledger-mute">Fallback</dt>
              <dd className="font-medium">
                {onTimeout === "RefundToSender" ? "Refund to me" : "Release to recipient"} after {timeoutDays} days
              </dd>
              <dt className="text-ledger-mute">Your SUSD balance</dt>
              <dd className="font-medium">{susdBalance === null ? "Checking…" : `${susdBalance} SUSD`}</dd>
            </dl>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-6 rounded-stamp bg-seal-brass text-white px-5 py-2.5 text-sm font-semibold hover:bg-seal-brassDark transition-colors disabled:opacity-60"
            >
              {submitting ? "Signing & locking…" : `Lock ${amount || 0} SUSD to ${merchant?.name || "merchant"}`}
            </button>
          </StepCard>
        )}
      </div>

      <aside>
        <h3 className="font-display font-semibold text-sm text-ledger-mute uppercase tracking-wide mb-3">
          Your locks
        </h3>
        {loadingLocks ? (
          <Spinner label="Loading your locks…" />
        ) : locks.length === 0 ? (
          <p className="text-sm text-ledger-mute">Nothing locked yet.</p>
        ) : (
          <ul className="grid gap-3">
            {locks
              .slice()
              .reverse()
              .map((l, i) => (
                <li key={l.id ?? `lock-${i}`} className="tear-edge rounded-stamp border border-ledger-line bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold text-sm capitalize">{l.category}</span>
                    <StatusPill status={l.status} />
                  </div>
                  <p className="text-xs text-ledger-mute mt-1">{l.amount} SUSD</p>
                  {l.receiptHash && (
                    <p className="text-[11px] text-ledger-mute mt-1 font-mono truncate">receipt: {l.receiptHash}</p>
                  )}
                </li>
              ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function StepCard({ title, onBack, children }) {
  return (
    <div className="rounded-stamp border border-ledger-line bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        {onBack && (
          <button onClick={onBack} aria-label="Back" className="text-ledger-mute hover:text-ledger-ink">
            ←
          </button>
        )}
        <h2 className="font-display font-semibold text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FallbackOption({ selected, onClick, title, body }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-stamp border p-3 transition-colors ${
        selected ? "border-seal-brass bg-seal-brass/5" : "border-ledger-line"
      }`}
    >
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-ledger-mute mt-0.5">{body}</p>
    </button>
  );
}
