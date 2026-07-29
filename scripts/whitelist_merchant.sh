#!/usr/bin/env bash
# Whitelists a merchant anchor address for a given category, so it can
# attest delivery and claim locks created against that category.
#
# Usage:
#   ./scripts/whitelist_merchant.sh <admin-identity> <contract-id> <merchant-address> <category>
#
# Example:
#   ./scripts/whitelist_merchant.sh suresend-admin CABC...XYZ GABC...SCHOOL school

set -euo pipefail

ADMIN_IDENTITY="$1"
CONTRACT_ID="$2"
MERCHANT_ADDRESS="$3"
CATEGORY="$4"
NETWORK="${NETWORK:-testnet}"

ADMIN_ADDRESS=$(stellar keys address "$ADMIN_IDENTITY")

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ADMIN_IDENTITY" \
  --network "$NETWORK" \
  -- add_merchant \
  --admin "$ADMIN_ADDRESS" \
  --merchant "$MERCHANT_ADDRESS" \
  --category "$CATEGORY"

echo "Whitelisted $MERCHANT_ADDRESS for category '$CATEGORY'"
