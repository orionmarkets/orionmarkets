#!/usr/bin/env bash
# Runs ON the VPS as root, once: creates /opt/orion/mainnet like testnet (docs/HOSTING.md) and brings orionmarkets.tech
# up read-only (every market disabled on the website):
#   checkout of the mainnet branch, stack.env with fresh secrets, service.env, database + migrations, a MAINNET env
#   profile (no private keys), the deployment values from the ORION record, build, API and web units.
#   bash deploy/mainnet-init.sh        (or: curl the file from the mainnet branch and pipe it to bash)
# Re-running is safe: every step that already happened is skipped.
set -euo pipefail
B=/opt/orion/mainnet
R=$B/repo
install -d -o orion -g orion "$B"
[ -d "$R/.git" ] || sudo -u orion git clone -q --branch mainnet https://github.com/orionmarkets/orionmarkets.git "$R"

umask 077
if [ ! -f "$B/stack.env" ]; then
  printf 'POSTGRES_PASSWORD=%s\nAUTHENTICATOR_PASSWORD=%s\nJWT_SECRET=%s\nDB_PORT=55822\nGATEWAY_PORT=55821\n' \
    "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > "$B/stack.env"
fi
[ -f "$B/service.env" ] || printf 'WEB_HOST=172.16.0.1\nWEB_PORT=3202\n' > "$B/service.env"

cd "$R"
sudo -u orion pnpm install --frozen-lockfile --prefer-offline >/dev/null
bash deploy/db-init.sh mainnet

WEB_ENV=apps/web/.env
if [ ! -f "$WEB_ENV" ]; then
  # shellcheck disable=SC1091
  . "$B/stack.env"
  ANON="$(sudo -u orion env ORION_JWT_SECRET="$JWT_SECRET" node -e 'import("./scripts/localnet/lib.mjs").then((m) => process.stdout.write(m.signJwt("anon")))')"
  sudo -u orion install -m 600 apps/web/.env.mainnet.example "$WEB_ENV"
  set_env() { sudo -u orion node scripts/ops/set-env-key.mjs "$WEB_ENV" "$1" "$2" >/dev/null; }
  set_env RPC_URL https://rpc.mainnet.chain.robinhood.com
  set_env CHAIN_NAME "Robinhood Chain"
  set_env SUPABASE_URL http://127.0.0.1:55821
  set_env SUPABASE_ANON_KEY "$ANON"
  set_env BACKEND_API_URL http://127.0.0.1:3201
  set_env PORT 3201
  set_env NODE_ENV production
  set_env API_BIND_HOST 127.0.0.1
  set_env WEB_ORIGIN https://orionmarkets.tech
  set_env NEXT_PUBLIC_SITE_URL https://orionmarkets.tech
  set_env NEXT_PUBLIC_X_HANDLE UseOrionMarkets
  set_env RELEASE_VERSION 1
  unset ANON JWT_SECRET POSTGRES_PASSWORD AUTHENTICATOR_PASSWORD
fi
# The API reads the repo-root .env; it gets the same public profile (no keys).
sudo -u orion install -m 600 "$WEB_ENV" .env

# Deployment values from the ORION record (markets disabled), then build and start through deploy.sh.
bash scripts/ops/enable-mainnet-web.sh addresses
systemctl enable --quiet orion-api@mainnet orion-web@mainnet
echo "mainnet ready on 127.0.0.1:3201 (API) and 172.16.0.1:3202 (web)"
