#!/usr/bin/env bash
# Runs ON the VPS as root, inside /opt/orion/mainnet/repo (docs/HOSTING.md). Writes the mainnet website's deployment
# values into apps/web/.env, then rebuilds and restarts orionmarkets.tech with deploy/deploy.sh.
#   enable-mainnet-web.sh addresses   read-only phase: PROTOCOL_ADDRESSES, USDG_ADDRESS and MARKET_DEPLOYMENTS_JSON
#                                     (every market disabled) from generate-mainnet-app-config.mjs
#   enable-mainnet-web.sh on          launch: the schema-validated values from generate-mainnet-app-config.mjs --launch
#                                     (every market enabled, LENDING_ENABLED and MARGIN_TRADING_ENABLED true)
#   enable-mainnet-web.sh off         emergency switch: LENDING_ENABLED and MARGIN_TRADING_ENABLED back to false
# Run `on` only after `scripts/ops/unpause-mainnet.sh` succeeded. TRADING_ENABLED stays false (the web schema
# rejects it together with lending or margin). The values come from packages/contracts/deployments/mainnet-4663.json
# on the mainnet branch, so commit and promote the ORION deployment record first.
set -euo pipefail
cd "$(dirname "$0")/../.."

MODE="${1:-}"
ENV_FILE=apps/web/.env
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE: copy apps/web/.env.mainnet.example and fill it in (docs/MAINNET.md, Phase 4)."; exit 1; }
grep -qE "^NETWORK_MODE='?MAINNET'?$" "$ENV_FILE" || { echo "$ENV_FILE is not a MAINNET profile; refusing to change it."; exit 1; }
[ "$(git rev-parse --abbrev-ref HEAD)" = "mainnet" ] || { echo "Run this in the mainnet checkout (branch mainnet)."; exit 1; }

# Replaces KEY=... in place (or appends it) as the file's owner, keeping the value literal in single quotes.
set_env() { sudo -u "$(stat -c %U "$ENV_FILE")" node scripts/ops/set-env-key.mjs "$ENV_FILE" "$1" "$2"; }
apply() { # "" or --launch, then the keys to copy
  local values
  # shellcheck disable=SC2086
  values="$(node scripts/generate-mainnet-app-config.mjs $1)" || { echo "Config did not validate"; exit 1; }
  shift
  for key in "$@"; do set_env "$key" "$(printf '%s' "$values" | jq -j --arg k "$key" '.[$k]')"; done
}

case "$MODE" in
  addresses)
    apply "" USDG_ADDRESS PROTOCOL_ADDRESSES MARKET_DEPLOYMENTS_JSON
    ;;
  on)
    apply --launch USDG_ADDRESS PROTOCOL_ADDRESSES MARKET_DEPLOYMENTS_JSON LENDING_DEPLOYMENT_JSON MARGIN_DEPLOYMENT_JSON LENDING_ENABLED MARGIN_TRADING_ENABLED
    ;;
  off)
    set_env LENDING_ENABLED false
    set_env MARGIN_TRADING_ENABLED false
    ;;
  *)
    echo "Usage: $0 addresses|on|off"
    exit 1
    ;;
esac

bash deploy/deploy.sh mainnet
echo
echo "Then run: node scripts/check-mainnet-readiness.mjs"
