# Architecture

## Data flow

```
sender fiat
   │
   ▼
home anchor (SEP-24 on-ramp)
   │  fiat -> stablecoin
   ▼
sender's wallet
   │  sender signs create_lock()
   ▼
SureSend Soroban contract
   │  holds funds, enforces category + merchant whitelist,
   │  tracks Locked -> DeliveryAttested -> Claimed
   ▼
merchant anchor (school / pharmacy / utility)
   │  attest_delivery() then claim()
   │  redeems into local settlement currency (SEP-24 off-ramp)
   ▼
merchant's local bank / cash-out
```

A parallel path handles the unhappy case: if nobody claims within
`timeout_secs`, anyone can call `expire()`, which pays out to either the
sender (refund) or the recipient's general wallet (release), per the
sender's choice at creation time.

## Why a Soroban contract instead of Stellar's native claimable balances

Stellar's native `ClaimClaimableBalanceOp` supports predicates
(time-bounds, and/or/not), but predicates only see time and
signatures — they can't express "only a merchant on an
admin-maintained whitelist for *this* category." That whitelist has
to live somewhere mutable and queryable, which is exactly what a
small Soroban contract gives us, while still using the same
claimable-balance *mental model* the ecosystem already understands.

## Contract responsibilities (`contracts/suresend`)

- `initialize` — one-time admin setup.
- `add_merchant` / `remove_merchant` — admin-controlled whitelist of
  `(merchant address, category)` pairs. This is the manual vetting
  step called out in the original idea submission's complexity
  evaluation; it is intentionally centralized for the MVP and is the
  first thing to decentralize post-pilot (see idea doc's mainnet
  vision: a merchant directory with reputation).
- `create_lock` — pulls stablecoin from the sender into contract
  custody, only if the target merchant is whitelisted for the chosen
  category. Rejects zero/negative amounts.
- `attest_delivery` — the proof-of-delivery gate. Kept as its own
  step (not folded into `claim`) so a later version can require a
  second signer (e.g. the recipient) here without changing the rest
  of the state machine.
- `claim` — merchant-only, requires `DeliveryAttested` status,
  transfers funds to the merchant.
- `expire` — permissionless after the timeout, executes the sender's
  pre-chosen fallback.
- `get_lock` / `get_locks_for` — read views the frontend polls.

## Known limitations (be upfront about these in review)

- **Partial redemption is not implemented.** If a school fee lock is
  smaller than the term's total bill, this MVP does not support
  accumulating multiple locks into one payment — the merchant just
  sees multiple separate locks. Real accumulation logic (partial
  claims against a running balance) is flagged in the original idea
  doc as a v2 problem, not an MVP one.
- **Merchant vetting is manual**, by the contract admin calling
  `add_merchant`. There's no on-chain identity/KYC check — that's
  handled off-chain via the anchor's own compliance process before
  the admin ever calls `add_merchant`.
- **`get_locks_for` scans linearly** over all locks. Fine for a pilot
  with a few hundred locks; would need an off-chain indexer
  (e.g. via Horizon/RPC event ingestion) at real scale.
- **The frontend ships in "demo mode" by default** (see
  `docs/DEPLOYMENT.md`) so the full flow can be clicked through and
  screenshotted before a testnet contract is live. Flip
  `VITE_DEMO_MODE=false` once the live-mode Soroban invoke calls are
  wired up in `frontend/src/lib/stellar.js`.
