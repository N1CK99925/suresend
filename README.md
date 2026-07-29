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

The app ships with `VITE_DEMO_MODE=true` by default: the full sender →
merchant → claim flow runs against `localStorage`, no wallet or deployed
contract required, so the product can be clicked through, screenshotted,
and demoed before the on-chain pieces are wired up. Flip
`VITE_DEMO_MODE=false` and set `VITE_SURESEND_CONTRACT_ID` once you've
deployed — see `docs/DEPLOYMENT.md` for what's left to implement on the
live-mode path (it's clearly marked in `frontend/src/lib/stellar.js`).

## Contract address

| Network | Contract ID |
|---|---|
| Testnet | `CDZP6FOHKYJEK6GCGMDBE5XJMDYLYODTTT7SH74LA3222NUHU27WJLYE` |

## Screenshots

_Add screenshots here before submitting — see the checklist below for
exactly what's needed._

- [ ] `docs/screenshots/sender-flow.png` — product UI, sender flow
- [ ] `docs/screenshots/mobile.png` — mobile responsive view
- [ ] `docs/screenshots/merchant-inbox.png` — merchant confirm/claim view
- [ ] `docs/screenshots/analytics.png` — analytics/monitoring setup (see `docs/ANALYTICS.md`)

## Demo video

`<link to your recorded walkthrough — see docs/DEPLOYMENT.md #5 for the suggested script>`

## User onboarding & feedback

The pilot plan is one diaspora community, one real school, 10–20 real
families — not broad signups. See
[`docs/USER_ONBOARDING.md`](docs/USER_ONBOARDING.md) for the recruiting
and onboarding script, and
[`docs/FEEDBACK_TEMPLATE.md`](docs/FEEDBACK_TEMPLATE.md) for the table to
fill in with real wallet-interaction proof and feedback once the pilot
runs. The in-app **Pilot stats** tab aggregates feedback-widget
submissions automatically.

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

## License

MIT — see [`LICENSE`](LICENSE).
