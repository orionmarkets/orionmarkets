#!/usr/bin/env bash
# Publishes the Orion token contract address on the website (mainnet and testnet), then redeploys both.
#   set-token-ca.sh 0xYourTokenAddress
# Sets NEXT_PUBLIC_TOKEN_CA in the orion-protocol-mainnet and orion-protocol-testnet Vercel projects (Production) and
# redeploys the latest production build of each, which makes the CA chip in the header, footer and mobile menu and the
# hero badge go live. The variable is inlined at build time, so the redeploy is what publishes it. The token lives on
# mainnet; testnet shows the same address and links to the mainnet explorer. To take the address down again:
# `vercel env rm NEXT_PUBLIC_TOKEN_CA production` in each project and redeploy.
set -uo pipefail
cd "$(dirname "$0")/../.."

CA="${1:-}"
SCOPE=rubencahyadi504-9120s-projects

[[ "$CA" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "Usage: $0 0x<40 hex characters>"; exit 1; }

for PROJECT in orion-protocol-mainnet orion-protocol-testnet; do
  printf '%s' "$CA" | vercel env add NEXT_PUBLIC_TOKEN_CA production --force --no-sensitive --project "$PROJECT" --scope "$SCOPE" >/dev/null \
    || { echo "FAILED to set NEXT_PUBLIC_TOKEN_CA in $PROJECT"; exit 1; }
  echo "set NEXT_PUBLIC_TOKEN_CA=$CA in $PROJECT"

  URL="$(vercel ls "$PROJECT" --scope "$SCOPE" 2>&1 | grep -m1 -E 'Ready +Production' | grep -oE 'https://[^ ]+')"
  [ -n "$URL" ] || { echo "No ready production deployment found for $PROJECT"; exit 1; }
  echo "Redeploying $URL"
  vercel redeploy "$URL" --scope "$SCOPE" || exit 1
done

echo
echo "Check it is live:"
echo "  curl -s https://www.orionmarkets.live | grep -c ${CA:2:8}"
echo "  curl -s https://testnet.orionmarkets.live | grep -c ${CA:2:8}"
