# Deployment guide

> **Rust version note:** the contract needs a reasonably current Rust
> toolchain — soroban-sdk 21.x pulls in dependencies (via
> `curve25519-dalek`) that require `edition2024`, which needs Rust 1.85+.
> Distro-packaged `rustc` (e.g. Ubuntu's, currently 1.75) is too old and
> will fail to resolve dependencies with an `edition2024` error. Install
> via [rustup](https://rustup.rs) rather than your OS package manager if
> `cargo test`/`cargo build` complains about this.

## 1. Contract → Stellar testnet

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt
stellar keys generate --global suresend-admin --network testnet --fund

cd contracts
cargo test          # runs the tests in contracts/suresend/src/test.rs
./../scripts/deploy_contract.sh
```

The script prints a contract ID and writes it to `.contract-id`. Save
that ID — it's required for the submission checklist ("Contract
deployment address") and for the frontend.

Whitelist your pilot merchant(s):

```bash
stellar contract invoke --id <CONTRACT_ID> --source suresend-admin --network testnet \
  -- add_merchant --merchant <MERCHANT_G_ADDRESS> --category school
```

## 2. Frontend → local dev

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

By default `VITE_DEMO_MODE=true`, so the whole sender → merchant →
claim flow works against `localStorage` with no wallet or contract
required — useful for screenshots and the demo video while the
contract/hosting pieces come together.

## 3. Going live

1. Set `VITE_SURESEND_CONTRACT_ID` in `.env` to the deployed contract
   ID from step 1.
2. Implement the live-mode branch in `frontend/src/lib/stellar.js`
   (`createLock`, `attestDelivery`, `claimLock`, `getLocksFor`) using
   `@stellar/stellar-sdk`'s `Contract` + `TransactionBuilder`, signed
   via the already-wired `stellar-wallets-kit` connection. The demo
   functions define the exact shape (`Lock` fields, status strings)
   the live calls need to return so the UI doesn't have to change.
3. Set `VITE_DEMO_MODE=false`.
4. `npm run build` and deploy `frontend/dist` to your static host of
   choice (Vercel, Netlify, Cloudflare Pages, or an S3 bucket all
   work fine for a Vite SPA — enable SPA fallback routing).

## 4. Analytics

See `docs/ANALYTICS.md`.

## 5. Recording the demo video

Walk through, in order: connect wallet (sender) → pick category →
pick merchant → set amount/fallback → sign → switch to "Merchant
inbox," connect the merchant address → confirm delivery → claim →
switch to "Recipient view" to show the "paid, confirmed" state. That
sequence maps directly to the reviewers' "real-world usefulness" and
"product quality" criteria.
