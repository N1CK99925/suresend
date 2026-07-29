#!/usr/bin/env bash
# Build and deploy the SureSend Soroban contract to testnet.
#
# Prereqs:
#   rustup target add wasm32-unknown-unknown
#   cargo install --locked stellar-cli --features opt
#   stellar keys generate --global suresend-admin --network testnet --fund
#
# Usage:
#   ./scripts/deploy_contract.sh
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
ADMIN_KEY="${ADMIN_KEY:-suresend-admin}"

echo "==> Building contract (release, wasm32)"
cd "$(dirname "$0")/../contracts"
stellar contract build

WASM_PATH="target/wasm32-unknown-unknown/release/suresend.wasm"

echo "==> Deploying to $NETWORK"
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source "$ADMIN_KEY" \
  --network "$NETWORK")

echo "==> Deployed. Contract ID: $CONTRACT_ID"
echo "$CONTRACT_ID" > ../.contract-id
echo "Wrote contract id to ../.contract-id"

echo "==> Initializing (admin = $ADMIN_KEY)"
ADMIN_ADDRESS=$(stellar keys address "$ADMIN_KEY")
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ADMIN_KEY" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS"

cat <<EOF

Done. Next steps:
  1. Copy this contract ID into frontend/.env as VITE_SURESEND_CONTRACT_ID.
  2. Whitelist your pilot merchant(s), e.g.:
     stellar contract invoke --id $CONTRACT_ID --source $ADMIN_KEY --network $NETWORK \\
       -- add_merchant --merchant <MERCHANT_G_ADDRESS> --category school
  3. Set VITE_DEMO_MODE=false once the live-mode invoke calls in
     src/lib/stellar.js are implemented (see docs/DEPLOYMENT.md).
EOF
