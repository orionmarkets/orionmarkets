#!/usr/bin/env bash
# Run the RH canonical indexer against the Supabase project, for the TSLA long and short pairs.
# Needs .secrets/supabase-db.env (mode 0600, git-ignored) containing one line:
#   DATABASE_PASSWORD=<the Supabase database password>
# Usage: run-supabase-indexer.sh --sync|--serve|--status
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
MODE="${1:---sync}"
PROJECT_REF="oxwwhlxasrjnpuaizoen"
POOLER_HOST="aws-0-ap-southeast-1.pooler.supabase.com"   # session pooler (port 5432); this machine has no IPv6
SECRET=".secrets/supabase-db.env"
[ -f "$SECRET" ] || { echo "Missing $SECRET (DATABASE_PASSWORD=...)"; exit 1; }
[ "$(( $(stat -c %a "$SECRET") % 100 ))" = "0" ] || { echo "$SECRET must be mode 0600"; exit 1; }

eval "$(node --input-type=module - "$PROJECT_REF" "$POOLER_HOST" <<'JS'
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
const [ref, host] = process.argv.slice(2);
const e = parseEnv(readFileSync(".env.testnet", "utf8"));
const pw = parseEnv(readFileSync(".secrets/supabase-db.env", "utf8")).DATABASE_PASSWORD;
if (!pw) throw Error("DATABASE_PASSWORD missing");
const margin = JSON.parse(e.MARGIN_DEPLOYMENT_JSON);
const out = {
  NETWORK_MODE: e.NETWORK_MODE, CHAIN_ID: e.CHAIN_ID, TRADING_ENABLED: "false",
  RPC_URL: e.RPC_URL, RPC_TIMEOUT_MS: e.RPC_TIMEOUT_MS, INDEXER_RPC_URL: e.INDEXER_RPC_URL,
  SUPABASE_URL: `https://${ref}.supabase.co`,
  DATABASE_URL: `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@${host}:5432/postgres`,
  DATABASE_SSL_CA_PATH: "data/certificates/supabase-ca.crt",
  // Pin of data/certificates/supabase-ca.crt (Supabase Root 2021 CA, valid to 2031-04-26); checked against the live pooler chain.
  DATABASE_SSL_CA_SHA256: "807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa",
  INDEXER_POLICY_JSON: JSON.stringify({ confirmations: 2, batchBlocks: 500, maxBatches: 40, pollIntervalMs: 15000 }),
  INDEXER_MARKETS_JSON: JSON.stringify([
    { symbol: "TSLA", side: "long", startBlock: "135836548", deployment: JSON.parse(e.LENDING_DEPLOYMENT_JSON) },
    { symbol: "TSLA", side: "short", startBlock: "135840034", deployment: margin.short },
  ]),
};
for (const [k, v] of Object.entries(out)) console.log(`export ${k}='${String(v).replaceAll("'", "'\\''")}'`);
JS
)"
exec node --import tsx scripts/run-rh-indexer.mjs "$MODE" --runtime
