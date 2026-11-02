#!/usr/bin/env bash
# Closes the two mainnet contracts that have no working front end or worker yet:
#   - OrionVault deposits (the vault holds USDG but allocates nothing and pays no yield),
#   - AutoProtectModule (no keeper runs, so a saved rule would never act).
# Run by the owner from their own terminal. Reads PRIVATE_KEY from .env.mainnet.core.local, refuses any key
# that is not the project owner, and skips contracts that are already paused.
set -uo pipefail
cd "$(dirname "$0")/../.."

RPC=https://rpc.mainnet.chain.robinhood.com
REC=packages/contracts/deployments/mainnet-4663.json
PK="$(grep -m1 '^PRIVATE_KEY=' .env.mainnet.core.local | cut -d= -f2- | tr -d "\"' ")"

[ "$(cast chain-id --rpc-url "$RPC")" = "4663" ] || { echo "Not chain 4663"; exit 1; }
[ "$(cast wallet address --private-key "$PK" | tr A-Z a-z)" = "$(jq -r .owner "$REC" | tr A-Z a-z)" ] || { echo "Key is not the project owner"; exit 1; }
echo "Signer OK"

pause() { # name  paused-getter  setter
  local address
  address="$(jq -r ".addresses.$1" "$REC")"
  if [ "$(cast call "$address" "$2" --rpc-url "$RPC")" = "true" ]; then
    echo "== $1 already paused"
  else
    echo "== pause $1 ($address)"
    cast send "$address" "$3" true --rpc-url "$RPC" --private-key "$PK" || { echo "FAILED at $1"; exit 1; }
  fi
}

pause vault 'depositsPaused()(bool)' 'setDepositsPaused(bool)'
pause autoProtect 'isPaused()(bool)' 'setPaused(bool)'
unset PK
echo
echo "vault depositsPaused=$(cast call "$(jq -r .addresses.vault "$REC")" 'depositsPaused()(bool)' --rpc-url "$RPC")"
echo "autoProtect isPaused=$(cast call "$(jq -r .addresses.autoProtect "$REC")" 'isPaused()(bool)' --rpc-url "$RPC")"
