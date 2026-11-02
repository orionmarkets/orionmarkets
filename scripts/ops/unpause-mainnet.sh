#!/usr/bin/env bash
# Opens LeverageRouter, ShortRouter, AutoProtect and the vault deposits on Robinhood Chain mainnet (4663).
# Run by the owner from their own terminal. Reads PRIVATE_KEY from .env.mainnet.core.local, refuses any key
# that is not the project owner, skips contracts that are already open, and prints no secret.
set -uo pipefail
cd "$(dirname "$0")/../.."

RPC=https://rpc.mainnet.chain.robinhood.com
REC=packages/contracts/deployments/mainnet-4663.json
PK="$(grep -m1 '^PRIVATE_KEY=' .env.mainnet.core.local | cut -d= -f2- | tr -d "\"' ")"

[ "$(cast chain-id --rpc-url "$RPC")" = "4663" ] || { echo "Not chain 4663"; exit 1; }
SIGNER="$(cast wallet address --private-key "$PK")"
OWNER="$(jq -r .owner "$REC")"
[ "${SIGNER,,}" = "${OWNER,,}" ] || { echo "Key is not the project owner"; exit 1; }
echo "Signer OK: $SIGNER"

unpause() { # name  paused-getter  setter
  local address
  address="$(jq -r ".addresses.$1" "$REC")"
  if [ "$(cast call "$address" "$2" --rpc-url "$RPC")" = "true" ]; then
    echo "== unpause $1 ($address)"
    cast send "$address" "$3" false --rpc-url "$RPC" --private-key "$PK" || { echo "FAILED at $1"; exit 1; }
  else
    echo "== $1 already open"
  fi
}

unpause leverageRouter 'isPaused()(bool)' 'setPaused(bool)'
unpause shortRouter 'isPaused()(bool)' 'setPaused(bool)'
unpause autoProtect 'isPaused()(bool)' 'setPaused(bool)'
unpause vault 'depositsPaused()(bool)' 'setDepositsPaused(bool)'
unset PK

echo
echo "===== VERIFY ====="
node scripts/check-mainnet-readiness.mjs | sed -n '1,12p'
