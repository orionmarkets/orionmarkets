#!/usr/bin/env bash
# Sells the leftover TSLA, AMZN, PLTR and AMD from the buying buffer for USDG (see scripts/sell-leftover-stock.mjs).
# Shows the quotes first and asks for SELL before it broadcasts. The broadcast switch is turned off again on exit.
set -euo pipefail
cd "$(dirname "$0")/../.."
ENV_FILE=".env.mainnet.core.local"
grep -q '^MAINNET_SWAP_BROADCAST_ENABLED=' "$ENV_FILE" || printf '\nMAINNET_SWAP_BROADCAST_ENABLED=false\n' >> "$ENV_FILE"
set_flag() { sed -i "s/^MAINNET_SWAP_BROADCAST_ENABLED=.*/MAINNET_SWAP_BROADCAST_ENABLED=$1/" "$ENV_FILE"; }
trap 'set_flag false' EXIT
set_flag false
node scripts/sell-leftover-stock.mjs --plan
read -r -p "Type SELL to sell these tokens for USDG on MAINNET: " phrase
[ "$phrase" = "SELL" ] || { echo "Aborted."; exit 1; }
set_flag true
node scripts/sell-leftover-stock.mjs --run
