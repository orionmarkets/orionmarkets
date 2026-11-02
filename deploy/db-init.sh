#!/usr/bin/env bash
# Runs ON the VPS: create roles and apply migrations on a fresh database (idempotent), then reload PostgREST.
# Usage: deploy/db-init.sh testnet|mainnet   (no seed: production data comes from the chain via the indexer)
set -euo pipefail
NET="${1:?testnet or mainnet}"
BASE="/opt/orion/$NET"
C=(docker compose -p "orion-$NET" --env-file "$BASE/stack.env" -f "$BASE/repo/docker/production/compose.yml")
# shellcheck disable=SC1091
. "$BASE/stack.env"
psql() { "${C[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d orion "$@"; }
"${C[@]}" up -d --wait db >/dev/null
if [ "$(psql -tA -c "select to_regclass('public.markets') is null")" = "t" ]; then
  sed "s/orion_local_only/$AUTHENTICATOR_PASSWORD/" "$BASE/repo/supabase/local/00_roles.sql" | psql -q
  for f in "$BASE"/repo/supabase/migrations/*.sql; do echo "migration $(basename "$f")"; psql -q < "$f"; done
fi
"${C[@]}" up -d --wait >/dev/null
psql -q -c "notify pgrst, 'reload schema';"
echo "db ready ($NET)"
