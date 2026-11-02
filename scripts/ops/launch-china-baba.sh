#!/usr/bin/env bash
# Launches the China Equities market (BABA) on mainnet in one run:
#   1. preflight (branch, tools, vercel login)
#   2. add + fund + open the BABA market at nano size (interactive: type "ADD BABA")
#   3. commit the web code and the updated deployment record, push main
#   4. wait for the Vercel build, then turn the market on for the website (enable-mainnet-web.sh on)
#   5. check the live site
#   6. optionally promote main to the testnet and mainnet branches
# Safe to re-run: the add script resumes from its journal, and an empty commit step is skipped.
#   bash scripts/ops/launch-china-baba.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

SITE=https://www.orionmarkets.live
PROJECT=orion-protocol-mainnet
SCOPE=rubencahyadi504-9120s-projects
step() { printf '\n== %s ==\n' "$*"; }
die() { echo "STOP: $*" >&2; exit 1; }

step "1/6 Preflight"
for tool in node git curl jq vercel cast; do command -v "$tool" >/dev/null || die "$tool is not installed"; done
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || die "run this on the main branch"
vercel whoami --scope "$SCOPE" >/dev/null 2>&1 || die "vercel is not logged in (run: vercel login)"
[ -f .env.mainnet.core.local ] || die ".env.mainnet.core.local is missing"
echo "Branch main, tools and Vercel login are OK."

step "2/6 Add, fund and open the BABA market (nano size)"
echo "You will be asked to type: ADD BABA"
MAINNET_ENABLE_SIZE=nano bash scripts/add-rh-mainnet-market.sh BABA
node scripts/check-mainnet-readiness.mjs || echo "WARNING: readiness checker reported items above; review them."
grep -q '"BABA"' packages/contracts/deployments/mainnet-4663.json || die "BABA is not in the deployment record"

step "3/6 Commit and push"
git add apps data scripts docs packages/contracts/deployments
if git diff --cached --quiet; then
  echo "Nothing new to commit."
else
  git commit -q -m "feat: real China Equities (BABA market), remove the simulated pages, record the BABA deployment"
fi
git pull --rebase origin main
git push origin main
echo "Pushed $(git rev-parse --short HEAD)."

step "4/6 Wait for the Vercel build, then enable BABA on the website"
echo "Waiting for the production build of the new commit (up to 15 minutes)..."
sleep 90
for i in $(seq 1 27); do
  row="$(vercel ls "$PROJECT" --scope "$SCOPE" 2>&1 | grep -m1 -E 'Production' || true)"
  echo "  latest production deployment: $(echo "$row" | tr -s ' ' | cut -c1-110)"
  echo "$row" | grep -q 'Ready' && break
  sleep 30
done
echo "$row" | grep -q 'Ready' || die "the build is not Ready yet; when it is, run: bash scripts/ops/enable-mainnet-web.sh on"
bash scripts/ops/enable-mainnet-web.sh on

step "5/6 Check the live site"
sleep 20
ok=0
for i in $(seq 1 10); do
  if curl -s -m 30 "$SITE/markets/china" | grep -q 'BABA'; then ok=1; break; fi
  sleep 15
done
if [ "$ok" = 1 ]; then
  echo "OK: $SITE/markets/china lists BABA."
else
  echo "WARNING: $SITE/markets/china does not show BABA yet. The redeploy may still be building."
  echo "Check again in a few minutes. If the build used old code, re-run: bash scripts/ops/enable-mainnet-web.sh on"
fi
systemctl --user restart orion-watch 2>/dev/null && echo "Restarted the orion-watch service." || echo "orion-watch service not restarted (not installed here)."

step "6/6 Promote the branches (optional)"
read -r -p "Merge main into testnet and mainnet and push? Type YES to do it: " answer
if [ "$answer" = "YES" ]; then
  git checkout testnet && git merge --no-ff -m "Merge main into testnet" main && git push origin testnet
  git checkout mainnet && git merge --no-ff -m "Merge testnet into mainnet" testnet && git push origin mainnet
  git checkout main
  echo "Branches promoted."
else
  echo "Skipped. Promote later with the commands in docs/BRANCHING.md."
fi

echo
echo "Done. Open $SITE/markets/china and check BABA."
