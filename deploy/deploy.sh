#!/usr/bin/env bash
# Runs ON the VPS as root: pull the network's branch, build, restart. Usage: deploy.sh testnet|mainnet
# The env profiles (.env, .env.<network>, apps/web/.env) are git-ignored files inside the checkout; the deployment
# pipeline writes real addresses into them, and `git reset --hard` leaves them alone.
set -euo pipefail
NET="${1:?testnet or mainnet}"
cd "/opt/orion/$NET/repo"
sudo -u orion git fetch --quiet origin "$NET"
sudo -u orion git reset --quiet --hard "origin/$NET"
sudo -u orion pnpm install --frozen-lockfile --prefer-offline
sudo -u orion env NEXT_TELEMETRY_DISABLED=1 pnpm build
systemctl restart "orion-api@$NET" "orion-web@$NET"
echo "deployed $NET at $(git rev-parse --short HEAD)"
