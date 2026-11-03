#!/usr/bin/env bash
# Opens ORION v1.0 on Robinhood Chain mainnet after the deployment (docs/MAINNET.md, Phase 5), signed from this terminal:
#   1. buy the seed tokens (size from MAINNET_ENABLE_SIZE in the profile, nano for the $7 budget)
#   2. open the five markets (enable-rh-mainnet-markets.sh: fork rehearsal, then type OPEN MARKETS)
#   3. open LeverageRouter and ShortRouter, keep the vault and AutoProtect paused (v3.0 and v2.0)
#   4. read-only readiness check of the chain gates
# Every stage is rehearsed on a fork first and journaled, so a re-run resumes. Broadcast switches are on only
# for their own step.
#   bash scripts/ops/open-mainnet-v1.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
ENV_FILE=".env.mainnet.core.local"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE: run bash scripts/ops/init-mainnet-profile.sh first."; exit 1; }
[ -f packages/contracts/deployments/mainnet-4663.json ] || { echo "No ORION deployment record: deploy first (Phase 1)."; exit 1; }
set_flag() { sed -i "s/^MAINNET_SWAP_BROADCAST_ENABLED=.*/MAINNET_SWAP_BROADCAST_ENABLED=$1/" "$ENV_FILE"; }
trap 'set_flag false' EXIT
set_flag false
echo "Seed size: $(grep -m1 '^MAINNET_ENABLE_SIZE=' "$ENV_FILE" | cut -d= -f2)"

echo "== 1/4 Seed tokens =="
node scripts/buy-mainnet-market-tokens.mjs --plan
read -r -p "Rehearsal above passed. Type BUY to buy the seed tokens on MAINNET (real ETH): " phrase
[ "$phrase" = "BUY" ] || { echo "Aborted."; exit 1; }
set_flag true
node scripts/buy-mainnet-market-tokens.mjs --run
set_flag false

echo "== 2/4 Open the markets =="
bash scripts/enable-rh-mainnet-markets.sh

echo "== 3/4 Routers (vault and AutoProtect stay paused) =="
bash scripts/ops/unpause-mainnet.sh
bash scripts/ops/pause-mainnet-unused.sh

echo "== 4/4 Readiness (chain gates; the API checks pass once the VPS site is up) =="
node scripts/check-mainnet-readiness.mjs || true
echo "On chain, ORION v1.0 is open. Next: the website on the VPS (docs/MAINNET.md, Phase 3 to 5)."
