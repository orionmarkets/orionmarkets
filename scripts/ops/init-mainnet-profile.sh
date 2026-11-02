#!/usr/bin/env bash
# Creates .env.mainnet.core.local for the Robinhood Chain MAINNET deployment from the single project wallet.
#
# The private key is typed at a hidden prompt, so it never appears in a chat, a shell history or a process list.
# The script derives the address from the key and refuses anything but the project wallet. It writes the file
# with mode 0600 (git-ignored), with every broadcast flag OFF and gas caps taken from docs/MAINNET_BUDGET.md.
#
# Usage: bash scripts/ops/init-mainnet-profile.sh [--force]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PROFILE=".env.mainnet.core.local"
WALLET="0xd09D9c87ECfe008B4D6D3cEbeAd25103c16d9a7C"

if [ -e "$PROFILE" ] && [ "${1:-}" != "--force" ]; then
  echo "$PROFILE already exists. Use --force to replace it (the old file is not kept)."; exit 1
fi
git check-ignore -q "$PROFILE" || { echo "$PROFILE is not git-ignored; refusing to create it."; exit 1; }
command -v cast >/dev/null || { echo "Foundry's cast is required."; exit 1; }

printf 'Private key of %s (input is hidden): ' "$WALLET"
read -rs PK; echo
PK="${PK#0x}"
[[ "$PK" =~ ^[0-9a-fA-F]{64}$ ]] || { echo "That is not a 64-hex-character private key."; exit 1; }
DERIVED="$(cast wallet address --private-key "0x$PK")"
if [ "${DERIVED,,}" != "${WALLET,,}" ]; then
  unset PK
  echo "This key belongs to a different wallet ($DERIVED). Nothing was written."; exit 1
fi

umask 077
cat > "$PROFILE" <<EOF
# Robinhood Chain MAINNET deployment profile for the single project wallet. Never commit, never load into web/backend.
NETWORK_MODE=MAINNET
CHAIN_ID=4663
CHAIN_NAME=Robinhood Chain
NATIVE_CURRENCY_NAME=Ether
NATIVE_CURRENCY_SYMBOL=ETH
NATIVE_CURRENCY_DECIMALS=18
EXPLORER_URL=https://robinhoodchain.blockscout.com
RPC_URL=https://rpc.mainnet.chain.robinhood.com

PRIVATE_KEY=0x$PK
DEPLOYER_ADDRESS=$WALLET
PROTOCOL_OWNER_ADDRESS=$WALLET

# Gas caps from docs/MAINNET_BUDGET.md (wei). Fee cap 0.04 gwei: above that, wait. Per-tx cap covers the largest
# deployment (2.5M gas) at the fee cap with the 1.3x limit buffer. Total cap is about 2x the expected deploy cost.
MAINNET_MAX_FEE_PER_GAS_WEI=40000000
MAINNET_MAX_TRANSACTION_GAS_WEI=150000000000000
MAINNET_FULL_MAX_TOTAL_GAS_WEI=1000000000000000
MAINNET_MINIMUM_GAS_RESERVE_WEI=50000000000000
MAINNET_GAS_LIMIT_BUFFER_BPS=13000
MAINNET_RECEIPT_CONFIRMATIONS=2
MAINNET_RECEIPT_TIMEOUT_MS=180000

# Application flags stay off until the owner enables them after supervised tests.
TRADING_ENABLED=false
LENDING_ENABLED=false
MARGIN_TRADING_ENABLED=false

# Broadcast switches. The interactive wrappers turn each one on for its own step only and switch it back off.
MAINNET_DEPLOYMENT_SCOPE=FULL
MAINNET_FULL_BROADCAST_ENABLED=false
MAINNET_SWAP_BROADCAST_ENABLED=false
MAINNET_ENABLE_BROADCAST_ENABLED=false
MAINNET_ADD_BROADCAST_ENABLED=false
MAINNET_ENABLE_SIZE=micro
MAINNET_BUY_MARKETS=TSLA,AMZN,PLTR,AMD

# Vault (underlying must equal the USDG token in scripts/mainnet-full-deploy.config.json).
MAINNET_VAULT_ASSET_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
MAINNET_VAULT_ASSET_SYMBOL=USDG
MAINNET_VAULT_ASSET_DECIMALS=6
MAINNET_VAULT_NAME=Orion USDG Yield Vault
MAINNET_VAULT_SYMBOL=oUSDG
MAINNET_VAULT_SLUG=orion-usdg-vault-mainnet
MAINNET_VAULT_RISK_TIER=Conservative
EOF
unset PK
chmod 600 "$PROFILE"
echo "Wrote $PROFILE (mode $(stat -c %a "$PROFILE")) for $WALLET. All broadcast switches are off."
echo "ETH on chain 4663: $(cast balance "$WALLET" --rpc-url https://rpc.mainnet.chain.robinhood.com --ether) | nonce: $(cast nonce "$WALLET" --rpc-url https://rpc.mainnet.chain.robinhood.com)"
