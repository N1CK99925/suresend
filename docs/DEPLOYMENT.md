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

The live-mode branch in `frontend/src/lib/stellar.js` is already
implemented — `createLock`, `attestDelivery`, `claimLock`,
`getLocksFor`, `trustSUSD`, `approveSUSD`, and `getSUSDBalance` all talk
to the deployed Soroban contracts through `@stellar/stellar-sdk`
(`Contract` + `TransactionBuilder`), signed via the wired-up
`stellar-wallets-kit` connection. To point a build at production:

1. Set `VITE_SURESEND_CONTRACT_ID` and `VITE_SUSD_CONTRACT_ID` in
   `frontend/.env` to the deployed contract IDs (SureSend + SUSD).
2. Set `VITE_DEMO_MODE=false`.
3. `npm run build`.
4. Deploy `frontend/dist` to Netlify (see `netlify.toml` — it publishes
   `frontend/dist` and serves `netlify/functions` for the feedback
   endpoints). Configure the `GITHUB_TOKEN` and `GITHUB_REPO`
   environment variables for the feedback functions in the Netlify
   dashboard. Any static host with SPA fallback routing works too.

## 4. Analytics

See `docs/ANALYTICS.md`.

## 5. Recording the demo video

Walk through, in order: connect wallet (sender) → pick category →
pick merchant → set amount/fallback → sign → switch to "Merchant
inbox," connect the merchant address → confirm delivery → claim →
switch to "Recipient view" to show the "paid, confirmed" state. That
sequence maps directly to the reviewers' "real-world usefulness" and
"product quality" criteria.
