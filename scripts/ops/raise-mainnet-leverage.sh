#!/usr/bin/env bash
# Opens 2x, 5x and 10x on every ORION mainnet market, signed from this terminal:
#   bash scripts/ops/raise-mainnet-leverage.sh
# Fork rehearsal first (parameters plus every user flow at 2x/5x/10x), then type RAISE LEVERAGE to broadcast the
# 20 parameter transactions. Resumable: applied steps are skipped. Afterwards, on the VPS:
#   bash scripts/ops/enable-mainnet-web.sh on     (the website then offers 2x/5x/10x)
set -euo pipefail
cd "$(dirname "$0")/../.."
ENV_FILE=".env.mainnet.core.local"
FLAG=MAINNET_LEVERAGE_BROADCAST_ENABLED
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE: run bash scripts/ops/init-mainnet-profile.sh first."; exit 1; }
grep -q "^$FLAG=" "$ENV_FILE" || printf '\n%s=false\n' "$FLAG" >> "$ENV_FILE"
set_flag() { sed -i "s/^$FLAG=.*/$FLAG=$1/" "$ENV_FILE"; }
trap 'set_flag false' EXIT
set_flag false

node scripts/raise-mainnet-leverage.mjs --plan
read -r -p "Rehearsal above passed. Type RAISE LEVERAGE to broadcast to MAINNET (real ETH, about \$0.10): " phrase
[ "$phrase" = "RAISE LEVERAGE" ] || { echo "Aborted."; exit 1; }
set_flag true
node scripts/raise-mainnet-leverage.mjs --run
set_flag false
node scripts/raise-mainnet-leverage.mjs --verify
echo "On chain: 2x/5x/10x open. Next, on the VPS: bash scripts/ops/enable-mainnet-web.sh on"
