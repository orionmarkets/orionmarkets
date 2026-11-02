#!/usr/bin/env bash
# Turns Lending, Trade and the market pages on (or off) for the mainnet website, then redeploys it.
#   enable-mainnet-web.sh on    sets the schema-validated launch variables from
#                               `generate-mainnet-app-config.mjs --launch` in the orion-protocol-mainnet
#                               Vercel project (Production) and redeploys the latest production build.
#   enable-mainnet-web.sh off   emergency switch: LENDING_ENABLED and MARGIN_TRADING_ENABLED back to false.
# Run it only after `scripts/ops/unpause-mainnet.sh` succeeded. TRADING_ENABLED stays false (the web schema
# rejects it together with lending or margin).
set -uo pipefail
cd "$(dirname "$0")/../.."

MODE="${1:-}"
PROJECT=orion-protocol-mainnet
SCOPE=rubencahyadi504-9120s-projects
vc() { vercel "$@" --project "$PROJECT" --scope "$SCOPE"; }

set_env() { # name value
  printf '%s' "$2" | vc env add "$1" production --force >/dev/null || { echo "FAILED to set $1"; exit 1; }
  echo "set $1"
}

case "$MODE" in
  on)
    LAUNCH="$(node scripts/generate-mainnet-app-config.mjs --launch)" || { echo "Config did not validate"; exit 1; }
    for key in LENDING_ENABLED MARGIN_TRADING_ENABLED PROTOCOL_ADDRESSES LENDING_DEPLOYMENT_JSON MARGIN_DEPLOYMENT_JSON MARKET_DEPLOYMENTS_JSON; do
      set_env "$key" "$(printf '%s' "$LAUNCH" | jq -j --arg k "$key" '.[$k]')"
    done
    ;;
  off)
    set_env LENDING_ENABLED false
    set_env MARGIN_TRADING_ENABLED false
    ;;
  *)
    echo "Usage: $0 on|off"
    exit 1
    ;;
esac

URL="$(vercel ls "$PROJECT" --scope "$SCOPE" 2>&1 | grep -m1 -E 'Ready +Production' | grep -oE 'https://[^ ]+')"
[ -n "$URL" ] || { echo "No ready production deployment found"; exit 1; }
echo "Redeploying $URL"
vercel redeploy "$URL" --scope "$SCOPE" || exit 1

echo
echo "Wait for the build (about 1 to 10 minutes), then run:"
echo "  node scripts/check-mainnet-readiness.mjs"
