#!/usr/bin/env bash
# Pre-flight check before testing or screen-recording the Orion testnet site. Read-only: sends no transactions.
# Usage: preflight-testnet-site.sh [wallet-address]   (default: the deployer wallet)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a
# shellcheck disable=SC1090
. <(grep -E "^(RPC_URL|USDG_ADDRESS|DEPLOYER_ADDRESS)=" .env.testnet)
set +a
WALLET="${1:-$DEPLOYER_ADDRESS}"
# Deployment identity is read from .env.testnet (LENDING_DEPLOYMENT_JSON / MARGIN_DEPLOYMENT_JSON), never hard-coded.
dep() {
  python3 - "$1" <<'PY'
import json, re, sys
env = {}
for line in open(".env.testnet"):
    m = re.match(r"^([A-Z_]+)='?(.*?)'?$", line.rstrip())
    if m:
        env[m.group(1)] = m.group(2)
lend = json.loads(env["LENDING_DEPLOYMENT_JSON"])
marg = json.loads(env["MARGIN_DEPLOYMENT_JSON"])
print({
    "registry": lend["registry"], "long_id": lend["marketId"], "long_pair": lend["pair"],
    "router": marg["router"], "short_id": marg["short"]["marketId"], "short_pair": marg["short"]["pair"],
}[sys.argv[1]])
PY
}
SITE="${ORION_TESTNET_SITE:?Set ORION_TESTNET_SITE to your deployed testnet site URL}"
ROUTER="$(dep router)"
LONG_PAIR="$(dep long_pair)"
SHORT_PAIR="$(dep short_pair)"
fail=0
ok()   { echo "  PASS  $1"; }
bad()  { echo "  FAIL  $1"; fail=$((fail+1)); }
warn() { echo "  WARN  $1"; }

echo "Pre-flight for wallet $WALLET"

code=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "$SITE/trade?asset=TSLA"); [ "$code" = "200" ] && ok "site /trade responds (200)" || bad "site /trade returned $code"
code=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "$SITE/lending"); [ "$code" = "200" ] && ok "site /lending responds (200)" || bad "site /lending returned $code"

analytics=$(curl -s -m 30 "$SITE/api/analytics")
verified=$(echo "$analytics" | python3 -c "import sys,json; print(json.load(sys.stdin)['totals']['verifiedMarkets'])" 2>/dev/null)
[ "$verified" = "2" ] && ok "site verifies both TSLA markets (long + short)" || bad "site verifiedMarkets=$verified (want 2)"

hist=$(curl -s -m 60 -o /dev/null -w "%{http_code}" "$SITE/api/margin/history?account=$WALLET&market=TSLA"); [ "$hist" = "200" ] && ok "trade history API works (200)" || bad "trade history API returned $hist"

paused=$(cast call "$ROUTER" "isPaused()(bool)" --rpc-url "$RPC_URL" 2>/dev/null); [ "$paused" = "false" ] && ok "router unpaused" || bad "router paused=$paused (start the publisher)"

health=.secrets/rh-live/publisher-health.json
if [ -f "$health" ]; then
  python3 - "$health" <<'PY'
import sys, json, datetime
h = json.load(open(sys.argv[1]))
now = datetime.datetime.now(datetime.timezone.utc)
exp = datetime.datetime.fromisoformat(h["expiresAt"].replace("Z", "+00:00"))
upd = datetime.datetime.fromisoformat(h["updatedAt"].replace("Z", "+00:00"))
left = int((exp - now).total_seconds() / 60)
age = int((now - upd).total_seconds())
print(f"  INFO  publisher status={h['status']} publications={h['publications']} failures={h['failures']} last update {age}s ago, run ends in {left} min")
sys.exit(0 if h["status"] == "healthy" and age < 180 else 1)
PY
  [ $? -eq 0 ] && ok "publisher healthy and fresh" || bad "publisher not healthy (run: orion testnet publisher)"
else bad "no publisher health file"; fi

usdg=$(cast call "$USDG_ADDRESS" "balanceOf(address)(uint256)" "$WALLET" --rpc-url "$RPC_URL" 2>/dev/null | awk '{print $1}')
eth=$(cast balance "$WALLET" --rpc-url "$RPC_URL" --ether 2>/dev/null)
python3 -c "import sys; sys.exit(0 if int('${usdg:-0}')>=10_000_000 else 1)" && ok "wallet USDG $(python3 -c "print(int('${usdg:-0}')/1e6)") (need >= 10)" || bad "wallet USDG too low (${usdg:-0} raw); get USDG at https://faucet.paxos.com/"
python3 -c "import sys; sys.exit(0 if float('${eth:-0}')>=0.002 else 1)" && ok "wallet ETH $eth (need >= 0.002)" || bad "wallet ETH too low ($eth)"

for pair in "$LONG_PAIR" "$SHORT_PAIR"; do
  acct=$(cast call "$pair" "accounts(address)(uint256,uint256)" "$WALLET" --rpc-url "$RPC_URL" 2>/dev/null | tr '\n' ' ' | awk '{print $1"/"$2}')
  case "$acct" in 0/0*|"0 [0]/0"*|*"[0]/0"*) ok "no open position on $pair" ;; *) warn "wallet has a position on $pair ($acct); close it before recording" ;; esac
done

k=$(curl -s -m 10 -o /dev/null -w "%{http_code}" --http1.1 -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" https://ws.kraken.com/v2)
[ "$k" = "101" ] && ok "Kraken websocket reachable (price feed)" || bad "Kraken websocket returned $k (rate-limited? wait and stop extra publishers)"

echo
if [ "$fail" -eq 0 ]; then echo "READY: $fail failures."; else echo "NOT READY: $fail failure(s)."; fi
exit $fail
