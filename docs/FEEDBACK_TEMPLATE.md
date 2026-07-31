# Pilot user feedback and interaction evidence

The pilot has run and is complete. 11 Stellar Testnet users took part,
each connecting a distinct wallet address and walking through the
end-to-end workflow: wallet connection → enable SUSD → sender flow →
purpose-locked school-fee payment → feedback submission. Every tester
submitted feedback through the in-app feedback widget from their own
wallet address; the raw responses are recorded in `pilot-feedback.json`
and aggregated in the app's "Pilot stats" view.

## Pilot participants

| # | Role | Wallet address (short) | Action / evidence | Clarity rating (1-5) | Feedback |
|---|---|---|---|---|---|
| 1 | Sender | `GBYH…6Q6G` | Full pilot flow + feedback widget | 4 | "it works nice" |
| 2 | Sender | `GDHJ…7GME` | Full pilot flow + feedback widget | 4 | "Good enough, Requires UI refinements. As someone who works with blockchain, it was intuitive enough. For general public it might be confusing to understand what 'enabling SUSD' or Approving means. Also all the buttons changes states if one of them is active… And this feedback box is very tiny, I cannot edit my text now." |
| 3 | Sender | `GBHO…FY75` | Full pilot flow + feedback widget | 5 | "very immersive experience. would recommend to everyone. execution was smooth and easy to understand." |
| 4 | Recipient | `GCLJ…QGNT` | Full pilot flow + feedback widget | 3 | "It is fine, confusing but is nice. Can do better with the UI" |
| 5 | Sender | `GA7F…6HRD` | Full pilot flow + feedback widget | 4 | "a little confusing, the website can also be optimized, also neds more onboarding, as a person who is using web3 for the first time is confused." |
| 6 | Sender | `GBHS…INJ3` | Full pilot flow + feedback widget | 5 | "CLEARLY EXPLAINED. EASY TO NAVIGATE" |
| 7 | Sender | `GAMR…23WF` | Full pilot flow + feedback widget | 5 | "the steps for testing were very clearly explained… was confused with what SUSD and all meant… The ui is pretty clean and straightforward. Everything is clear… The application otherwise worked pretty smoothly." |
| 8 | Sender | `GAMY…XQC2` | Full pilot flow + feedback widget | 4 | "no not really" |
| 9 | Sender | `GCN7…MJST` | Full pilot flow + feedback widget | 5 | "The wallet approval steps were a little confusing at first. eveything else is good" |
| 10 | Sender | `GCAJ…DDHZ` | Full pilot flow + feedback widget | 4 | "Simple interface and the school fee locking process was clear." |
| 11 | Sender | `GAX2…UKPT` | Full pilot flow + feedback widget | 4 | "the payment flow was easy to follow" |

Wallet-interaction evidence is captured in the screenshots below rather
than per-user transaction hashes (no individual tx hashes were recorded
for this pilot):

- [`screenshots/wallet-proof-1.png`](screenshots/wallet-proof-1.png)
- [`screenshots/wallet-proof-2.png`](screenshots/wallet-proof-2.png)

## Pilot feedback summary

Aggregate from `pilot-feedback.json` (11 responses, 11 distinct Stellar
Testnet wallet addresses):

- **Respondents:** 11
- **Average clarity rating:** 4.3/5
- **Rating range:** 3–5/5 (six 4s, four 5s, one 3)
- **Roles represented:** 2 — 10 Senders, 1 Recipient

**Recurring themes:**

- The flow was generally **straightforward and easy to navigate** —
  several respondents described the execution as smooth and the UI as
  clean ("execution was smooth and easy to understand", "CLEARLY
  EXPLAINED. EASY TO NAVIGATE", "The ui is pretty clean and
  straightforward", "the payment flow was easy to follow").
- The **school-fee locking process was clear** to at least one tester:
  "Simple interface and the school fee locking process was clear."
- **SUSD / wallet-approval terminology was the main friction** — four
  respondents said "enabling SUSD" / "Approving" or the meaning of SUSD
  itself was confusing, particularly for people new to Web3.
- **First-time Web3 users asked for more onboarding** — three
  respondents explicitly said the experience was confusing without more
  onboarding.
- **UI refinement was requested** — several responses suggested the UI
  could be improved ("Can do better with the UI", "the website can also
  be optimized", "Could be made better"), and one noted the in-flight
  button states and the small feedback input were awkward.
- **The application worked smoothly** for the people who commented on
  stability ("worked pretty smoothly", "execution was smooth", "it works
  nice").

## What users found confusing

Recurring friction reported in the real feedback:

- **The meaning of SUSD** — respondents were unsure what SUSD was and
  why the flow involved it.
- **"Enable SUSD" / "Approve SUSD" terminology** — the approval steps
  were the single most-mentioned source of confusion.
- **Web3 concepts for first-time users** — people without Web3
  experience found the flow "a little confusing" and asked for more
  onboarding.
- **UI/state feedback** — one tester found it confusing that all buttons
  changed state while one action was in flight, and found the feedback
  input too small to edit.

## What worked well

Positive feedback that appears in the actual responses:

- **Straightforward navigation** — "EASY TO NAVIGATE", "u dont have any
  trouble finding anything".
- **Clear school-fee locking flow** — "the school fee locking process
  was clear".
- **Smooth payment flow** — "the payment flow was easy to follow",
  "execution was smooth and easy to understand".
- **Clean, simple interface** — "The ui is pretty clean and
  straightforward", "Simple interface".
- **Understandable testing instructions** — "the steps for testing were
  very clearly explained", "CLEARLY EXPLAINED".
- **Overall enthusiasm** — "very immersive experience. would recommend
  to everyone", "it works nice".

## Pilot evidence

![Pilot Stats](screenshots/pilot-stats.png)

![Wallet Interaction Proof 1](screenshots/wallet-proof-1.png)

![Wallet Interaction Proof 2](screenshots/wallet-proof-2.png)

## Changes / lessons from pilot feedback

Most feedback arrived near the end of the pilot, so the current
codebase reflects what was built going into the pilot rather than a
post-pilot revision pass. The improvements below are split into what is
verifiably already in the code and what is identified for future work.

**Already present in the current code (verified in source):**

- **SUSD balance check and balance display** in the sender flow —
  `frontend/src/components/SenderFlow.jsx` reads the sender's SUSD
  balance before locking and shows it on the review step, with an
  insufficient-balance message (see `docs/README.md` → "SUSD balance
  checks").
- **Human-readable Stellar/Soroban error handling** — transaction
  failures are mapped to readable messages with retry guidance via the
  `ErrorBanner` component.
- **Distinct loading/button states** — "Enabling SUSD…", "Approving…",
  and "Signing & locking…" labels during transaction building/signing.
- **Feedback copy/export** in the Pilot Stats view —
  `frontend/src/App.jsx` lets feedback be exported as JSON for the
  submission record.

**Identified for future iteration (from real feedback, not yet
implemented):**

- Clearer explanation of what SUSD is and why enabling/approving is
  required before the flow starts.
- Better onboarding language for first-time Web3 users (what a wallet
  approval is, why it's needed).
- UI/state refinements: keep button labels tied to the specific action
  in flight rather than showing all states active together, and give the
  feedback input more room to edit.

**Lesson for the next pilot:** the core purpose-locked payment flow is
usable and well received; onboarding and Web3 terminology are the main
areas to invest in next.
