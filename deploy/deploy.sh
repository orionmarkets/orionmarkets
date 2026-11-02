#!/usr/bin/env bash
# Runs ON the VPS as the orion user: pull a branch, build, restart. Usage: deploy.sh testnet|mainnet
# Env files live outside the repo in /opt/orion/<network>/ and are copied in before the build.
set -euo pipefail
NET="${1:?testnet or mainnet}"
BASE="/opt/orion/$NET"
cd "$BASE/repo"
git fetch --quiet origin "$NET"
git reset --quiet --hard "origin/$NET"
install -m 600 "$BASE/root.env" .env
install -m 600 "$BASE/root.env" ".env.$NET"
install -m 600 "$BASE/web.env" apps/web/.env
pnpm install --frozen-lockfile --prefer-offline
NEXT_TELEMETRY_DISABLED=1 pnpm build
sudo systemctl restart "orion-api@$NET" "orion-web@$NET"
echo "deployed $NET at $(git rev-parse --short HEAD)"
