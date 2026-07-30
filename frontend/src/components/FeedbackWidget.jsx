import React, { useState } from "react";
import { submitFeedback } from "../lib/stellar.js";
import { track, EVENTS } from "../lib/analytics.js";

const ROLES = ["Sender", "Recipient", "Merchant"];

export default function FeedbackWidget({ address }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("Sender");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await submitFeedback({ address, role, rating, comment });
      track(EVENTS.FEEDBACK_SUBMITTED, { role, rating });
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setRating(0);
        setComment("");
      }, 1400);
    } catch (err) {
      console.error("Feedback submission error", err);
      alert(
        "Feedback was saved locally, but there was a server issue. Check the Netlify function configuration."
      );
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setRating(0);
        setComment("");
      }, 1400);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 rounded-stamp bg-ledger-ink text-white px-4 py-2.5 text-sm font-medium shadow-lg hover:bg-ledger-slate"
      >
        Give feedback
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-[300px] rounded-stamp border border-ledger-line bg-white p-4 shadow-xl">
      {sent ? (
        <p className="text-sm font-medium text-route-green">Thanks — logged for the pilot review.</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold text-sm">Quick feedback</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ledger-mute">
              ✕
            </button>
          </div>
          <label className="text-xs font-medium">
            I was using this as a
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-stamp border border-ledger-line px-2 py-1.5 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs font-medium mb-1">How clear was the flow?</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setRating(n)}
                  className={`h-8 w-8 rounded-stamp border text-sm ${
                    rating >= n ? "bg-seal-brass text-white border-seal-brass" : "border-ledger-line"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs font-medium">
            Anything confusing or missing?
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-stamp border border-ledger-line px-2 py-1.5 text-sm"
              placeholder="Optional"
            />
          </label>
          <button
            type="submit"
            disabled={rating === 0}
            className="rounded-stamp bg-seal-brass text-white px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            Send feedback
          </button>
        </form>
      )}
    </div>
  );
}
