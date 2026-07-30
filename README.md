# SureSend

**Purpose-locked remittances on Stellar.** A migrant worker sends money
home for a specific thing — school fees, medicine, a utility bill — and
it can only be redeemed by the specific merchant anchor it was locked to.
If nobody redeems it in time, it either bounces back to the sender or
releases to the recipient, whichever the sender chose up front.

> Remittances have no memory of what they were for once they hit a bank
> account. This gives them one.

This repo is the Level 4 (Green Belt) submission: a production-shaped MVP
of the idea, one category deep (school fees, with medicine/utilities
scaffolded the same way), built to be piloted with one real sending
community and one real school.

## Live Deployment

Production MVP: https://suresend.netlify.app

- Network: Stellar Testnet
- Production deployment uses the live Stellar integration, not the local demo/localStorage path.
- The deployed experience is intended to interact with the live SureSend and SUSD Testnet contracts described below.

## Why Stellar

Anchors aren't just generic on/off ramps — they can *be* the merchant.
A school, a pharmacy, a utility provider can each be an anchor. Combined
with a small Soroban contract enforcing "only this merchant, only this
category," you get a remittance that can't drift from its purpose,
without inventing a new compliance/KYC stack — anchors already carry that.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data flow
and the reasoning behind using a contract instead of native claimable
balances.

## How it works

```
sender picks: category → merchant → amount → fallback → signs
       │
       ▼
Soroban contract locks stablecoin, tagged to that merchant + category
       │
       ▼
merchant confirms delivery (attest_delivery) — funds still locked
       │
       ▼
merchant claims (claim) — funds settle, only now
       │
       ▼
recipient's view shows "locked" → "delivery confirmed" → "paid, confirmed"

  ⤷ if nothing happens before the timeout: anyone can call `expire`,
    which pays out per the sender's original choice (refund / release)
```

## Repo structure

```
contracts/suresend/     Soroban contract (Rust) — the lock/attest/claim/expire state machine
frontend/               React + Vite app — sender, merchant, and recipient views
scripts/                Deploy + merchant-whitelisting helpers for the stellar CLI
docs/                   Architecture, deployment, analytics, and pilot-onboarding docs
```

## Quickstart

### Contract

```bash
cd contracts
cargo test              # runs contracts/suresend/src/test.rs
```

Deploying to testnet requires the `stellar` CLI (v22+) and a funded
identity — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full
walkthrough, or run:

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt
stellar keys generate --global suresend-admin --network testnet --fund
./scripts/deploy_contract.sh
./scripts/whitelist_merchant.sh suresend-admin <CONTRACT_ID> <MERCHANT_ADDRESS> school
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The app also supports a local wallet-free demo path with `VITE_DEMO_MODE=true` for development and walkthroughs. That mode is a convenience only; the production Netlify deployment uses `VITE_DEMO_MODE=false` so the UI interacts with the live Stellar Testnet contracts. The full end-to-end flow (create lock → attest delivery → claim settlement) is designed to work against the deployed Testnet contracts in production. See `docs/DEPLOYMENT.md` for the environment-variable reference.

### Loading states and error handling

The production frontend includes wallet connection states, transaction loading/pending states, SUSD balance checks, insufficient-balance handling, and user-facing Stellar/Soroban transaction error handling with retry guidance for failed actions.

## Contract addresses

| Contract | Address | Network |
|---|---|---|
| SureSend contract | `CDZP6FOHKYJEK6GCGMDBE5XJMDYLYODTTT7SH74LA3222NUHU27WJLYE` | Stellar Testnet |
| SUSD token contract | `CBKOVGHJNANMNAHU3IVOFB64PS74QKSQ3KA6PATYDN6N5S7U64UDCXNT` | Stellar Testnet |

## Screenshots

### Sender flow / Product UI
<!-- TODO before submission: add docs/screenshots/sender-flow.png -->

### Mobile responsive design
<!-- TODO before submission: add docs/screenshots/mobile.png -->

### Merchant inbox
<!-- TODO before submission: add docs/screenshots/merchant-inbox.png -->

### Production analytics / monitoring
<!-- TODO before submission: add docs/screenshots/analytics.png -->

### Pilot wallet interaction proof
<!-- TODO before submission: add docs/screenshots/wallet-interactions-1.png -->
<!-- TODO before submission: add docs/screenshots/wallet-interactions-2.png -->

## Demo video

<!-- TODO before submission: add final Loom/demo video URL -->

## User onboarding & pilot

The pilot workflow is documented for active use. Each tester connects a
unique Stellar Testnet wallet, enables SUSD, completes the sender flow,
creates a purpose-locked payment, and submits feedback through the
in-app feedback widget. The current workspace includes one captured
feedback submission from the in-app feedback flow; the final pilot count
and wallet-proof documentation should be completed before the final
submission.

### Pilot wallet interaction proof

Proof for the submission should consist of distinct Stellar Testnet
wallets successfully creating purpose-locked SUSD payments. The current
project materials include the in-app feedback flow and the Pilot Stats
experience; wallet-interaction screenshots should be added under the
screenshot paths above as the pilot progresses. See
[`docs/FEEDBACK_TEMPLATE.md`](docs/FEEDBACK_TEMPLATE.md) for the
submission-ready tracking template.

### Pilot feedback summary

The current workspace includes one captured feedback response from the
in-app feedback widget. Verified details:

- 1 feedback response
- average clarity rating: 4.0/5
- role represented: Sender
- recurring observation: "it works nice"

Additional feedback and participant details should be added as the pilot
continues. Feedback is collected through the in-app feedback widget and
aggregated in the Pilot Stats view.

## Analytics / monitoring

The production deployment uses Netlify Web Analytics for production
traffic monitoring. The app also emits analytics events for wallet
connection, lock creation, delivery attestation, claim, and feedback
submission. See [`docs/ANALYTICS.md`](docs/ANALYTICS.md) for the
monitoring setup and event list.

## Known limitations

- Partial redemption (accumulating several locks toward one larger bill)
  isn't implemented — flagged in the original idea doc as a v2 problem.
- Merchant vetting is manual (`add_merchant`, admin-only) — no on-chain
  identity/KYC check.
- `get_locks_for` is a linear scan, fine for pilot volume, not for scale.
- The frontend's `expire` (timeout refund/release) path isn't wired up
  in demo mode yet, since it's time-gated rather than click-driven — the
  contract-side logic is tested in `contracts/suresend/src/test.rs`.

Full detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Testing

- Contract: `cd contracts && cargo test` — requires Rust 1.85+ (install
  via [rustup](https://rustup.rs); older distro-packaged toolchains fail
  on an `edition2024` dependency error — see `docs/DEPLOYMENT.md`).
  See `suresend/src/test.rs` —
  happy path, non-whitelisted merchant, claim-without-attestation,
  double-claim, both expiry fallback directions, and role-filtered
  lookups).
- Frontend: manual click-through via demo mode is the fastest way to
  verify the full flow end to end; see `docs/DEPLOYMENT.md` for the
  suggested demo script.

## Level 4 submission evidence

| Requirement | Evidence |
|---|---|
| Production MVP | Production MVP overview and deployment guidance are documented in this README and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). |
| Stellar Testnet contract | SureSend and SUSD Testnet contract addresses are documented above. |
| Public GitHub repository | Public repository: https://github.com/N1CK99925/suresend |
| 15+ meaningful commits | Repository history includes more than 15 meaningful commits across contract and frontend work. |
| Production deployment | Live deployment: https://suresend.netlify.app |
| Mobile responsive UI | Pending screenshot evidence for the mobile view. |
| Analytics/monitoring | See [`docs/ANALYTICS.md`](docs/ANALYTICS.md) and the analytics section above. |
| 10+ user onboarding | Pending — the pilot count still needs to be completed and documented. |
| 10+ wallet interactions | Pending — wallet interaction proof and screenshots still need to be collected. |
| User feedback | Partially documented; the current workspace includes one captured feedback response. |
| Demo video | Pending — add final Loom/demo video URL. |

## License

MIT — see [`LICENSE`](LICENSE).
