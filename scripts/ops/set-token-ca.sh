#!/usr/bin/env bash
# Runs ON the VPS as root (docs/HOSTING.md). Publishes the ORION token contract address on both websites:
#   bash scripts/ops/set-token-ca.sh 0xYourTokenAddress
# Sets NEXT_PUBLIC_TOKEN_CA in /opt/orion/<network>/repo/apps/web/.env for mainnet and testnet and rebuilds each with
# deploy/deploy.sh, which makes the CA chip in the header, footer and mobile menu and the hero badge go live. The
# variable is inlined at build time, so the rebuild is what publishes it. The token lives on mainnet; testnet shows the
# same address and links to the mainnet explorer. To take it down again, set it to '' with set-env-key.mjs and redeploy.
set -euo pipefail
CA="${1:-}"
[[ "$CA" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "Usage: $0 0x<40 hex characters>"; exit 1; }

for NET in mainnet testnet; do
  REPO="/opt/orion/$NET/repo"
  ENV_FILE="$REPO/apps/web/.env"
  [ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }
  sudo -u "$(stat -c %U "$ENV_FILE")" node "$REPO/scripts/ops/set-env-key.mjs" "$ENV_FILE" NEXT_PUBLIC_TOKEN_CA "$CA"
  bash "$REPO/deploy/deploy.sh" "$NET"
done

echo
echo "Check it is live:"
echo "  curl -s https://orionmarkets.tech | grep -c ${CA:2:8}"
echo "  curl -s https://testnet.orionmarkets.tech | grep -c ${CA:2:8}"
