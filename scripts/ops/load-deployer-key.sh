#!/usr/bin/env bash
# Decrypts the Foundry keystore `deployer` (asks for its password) and writes the key into the git-ignored env profile
# as PRIVATE_KEY and KEEPER_PRIVATE_KEY (one project wallet). Prints only the derived address, never the key.
# Usage: bash scripts/ops/load-deployer-key.sh [.env.testnet]
set -euo pipefail
FILE="${1:-.env.testnet}"
[ -f "$FILE" ] || { echo "missing $FILE"; exit 1; }
KEY="$(cast wallet decrypt-keystore deployer | grep -oE '0x[0-9a-fA-F]{64}')"
ADDR="$(cast wallet address --private-key "$KEY")"
EXPECTED="$(grep -E '^DEPLOYER_ADDRESS=' "$FILE" | cut -d= -f2 | tr -d "\"'")"
[ "${ADDR,,}" = "${EXPECTED,,}" ] || { echo "keystore address $ADDR does not match DEPLOYER_ADDRESS"; exit 1; }
tmp="$(mktemp)"
grep -vE '^(PRIVATE_KEY|KEEPER_PRIVATE_KEY)=' "$FILE" > "$tmp"
printf 'PRIVATE_KEY="%s"\nKEEPER_PRIVATE_KEY=%s\n' "$KEY" "$KEY" >> "$tmp"
mv "$tmp" "$FILE"
chmod 600 "$FILE"
echo "loaded key for $ADDR into $FILE"
