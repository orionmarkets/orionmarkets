# ORIONMARKETS: Mainnet deployment plan (ORION v1.0)

Target: **Robinhood Chain mainnet** (chain id `4663`, explorer <https://robinhoodchain.blockscout.com>, public RPC `https://rpc.mainnet.chain.robinhood.com`).
Cost: see [`MAINNET_BUDGET.md`](MAINNET_BUDGET.md) (about $2.49 of gas with buffer, plus about $5.4 of seed tokens at micro size).
What v1.0 shows and opens: [`RELEASES.md`](RELEASES.md).

**Status (2026-11-03): ORION v1.0 is live on <https://orionmarkets.tech>.** Deployed (58 transactions, 0.000814 ETH,
31 of 31 contracts verified on Sourcify), the five markets opened at nano size, LeverageRouter and ShortRouter open,
lending and margin enabled on the website. Fork rehearsals on the live state pass: 60 of 60 user steps
(`REHEARSE_BORROW_USDG=0.01 REHEARSE_MARGIN_USDG=0.005`) and 5 of 5 liquidation checks. Readiness 36 of 38: the vault
and AutoProtect must be closed again with `bash scripts/ops/pause-mainnet-unused.sh`. The owner chose to skip the 24 h
read-only wait. Total spent about 0.00131 ETH (about $3).
Everything below deploys fresh from this repository: every contract (Orion
contracts, the Uniswap V2 factory and its pools), every market id (`orion-*` slugs) and the deployment record belong to
ORIONMARKETS. Nothing from an earlier deployment is reused. Every mainnet transaction is signed by the project owner
from their own terminal.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done.

## 1. Decisions

| Decision | Status |
| :--- | :--- |
| Project wallet | **Decided by the owner (2026-10-15): one wallet for everything on mainnet (`DEPLOYER_ADDRESS` in the local profile, `0xd09D…9a7C`).** It is the deployer, the contract owner (`PROTOCOL_OWNER_ADDRESS`), the keeper and the signer of every pause or unpause. `scripts/ops/init-mainnet-profile.sh` refuses any other key |
| Owner of the contracts | The project wallet. The multisig recommendation is waived by the owner; see the key-custody note below |
| Hosting | Decided: the project VPS, apex `orionmarkets.tech` ([`HOSTING.md`](HOSTING.md)) |
| Database | A dedicated mainnet Postgres on the VPS. Apply migrations only, never `supabase/seed.sql` |
| Domain and social handles | Decided: `orionmarkets.tech`, X `@UseOrionMarkets` |
| ORION token | Decided: launched by the owner on Pons and not traded on this website; v1.0 only shows its contract address ([`RELEASES.md`](RELEASES.md)) |
| Seed size | **Decided by the owner (2026-11-03): `nano`** (about $1.0 of tokens for five markets), so v1.0 stays within the $7 budget. The profile defaults to it; `micro` (about $5.4) would exceed the budget |

### Mandatory mitigations

1. Owner is the single project wallet (multisig waived). 2. Everything deploys **paused** (markets, routers, vault, AutoProtect). 3. Low launch caps sized so a total loss is survivable. 4. One market first, supervised wallet test, then the rest. 5. Pause runbook rehearsed on a fork before any unpause. 6. `TRADING_ENABLED`, `LENDING_ENABLED`, `MARGIN_TRADING_ENABLED` stay `false` until enablement.

**Key custody (single-wallet decision).** The contracts are upgradeable proxies, so whoever holds the project wallet's key controls upgrades, pauses, risk parameters and market listing. With one wallet there is no second signer to catch a mistake or a compromise. Keep the key out of every hosted environment: sign deployment, pause and unpause from the owner's own terminal.

## 2. Phases

Each phase has an entry gate; do not start one until the previous gate passes.

### Phase 0: Readiness

- [ ] `forge build && forge test` in `packages/contracts`
- [ ] `pnpm install --frozen-lockfile && pnpm lint && pnpm check:lending-abis && pnpm security:check && pnpm build`
- [ ] Mainnet RPC returns chain id `4663`
- [ ] Asset inventory: `scripts/mainnet-full-deploy.config.json` holds the Robinhood token and Chainlink feed addresses for USDG, TSLA, AMZN, PLTR, AMD and NVDA (the v1.0 launch set); re-check them on Blockscout
- [ ] `node scripts/estimate-mainnet-budget.mjs` is within band and the wallet holds the funds in [`MAINNET_BUDGET.md`](MAINNET_BUDGET.md)

### Phase 1: Deployment (owner broadcasts)

```bash
bash scripts/ops/init-mainnet-profile.sh   # hidden prompt for the key; refuses any wallet but the project wallet; every broadcast switch off
pnpm rh:mainnet:full:interactive           # fork rehearsal, then type DEPLOY MAINNET; journaled and resumable
pnpm rh:mainnet:full:verify                # read-only; writes packages/contracts/deployments/mainnet-4663.json
pnpm rh:mainnet:verify-sources             # Sourcify (rerun if it reports gaps: Sourcify is intermittent)
pnpm -s mainnet:verify                     # every ORION address on chain and on Sourcify
```

One run of 58 transactions (rehearsed 2026-11-03): nine implementations, the registry, lending router, AutoProtect,
ShortRouter, vault, LeverageRouter and VerifiedFeedOracle proxies, a long and a short `OrionPair` per market, ORION's
own Uniswap V2 factory and one pool per market (`createPair`), and one `MarginRouter` per market. Every market
registers **PAUSED**, every module starts paused, only the lending router is authorized. Then commit the record on
`main` and promote it ([`BRANCHING.md`](BRANCHING.md)); every later script and the website read it.

### Phase 2: Fork rehearsal of the product

`node --import tsx scripts/rehearse-mainnet-fork.mjs` replays deposit, borrow, repay, withdraw, long and short (open
and close, every policy option, every market) on a local fork with the website's own client code, and
`node scripts/rehearse-liquidation-fork.mjs` proves liquidation. Neither sends a mainnet transaction. Rehearse the pause
runbook (§4) on the same fork.

### Phase 3: Database and services (VPS)

- [ ] Data stack and env files for `mainnet` as in [`HOSTING.md`](HOSTING.md) (`deploy/db-init.sh mainnet`, `docker compose -p orion-mainnet …`); apply `supabase/migrations/*` in order
- [ ] `apps/web/.env` in `/opt/orion/mainnet/repo` from `apps/web/.env.mainnet.example`: `NETWORK_MODE=MAINNET`, `CHAIN_ID=4663`, `RPC_URL`, `RELEASE_VERSION=1`, `USDG_FAUCET_URL=''`, `NEXT_PUBLIC_SITE_URL=https://orionmarkets.tech`
- [ ] `bash scripts/ops/enable-mainnet-web.sh addresses` on the VPS: writes `PROTOCOL_ADDRESSES`, `USDG_ADDRESS` and `MARKET_DEPLOYMENTS_JSON` (markets disabled) from the record and rebuilds the site

### Phase 4: App live, read-only

- [ ] DNS `@` and `www` → `160.238.36.55`; `deploy/traefik-orion.yaml` copied to `/data/coolify/proxy/dynamic/orion.yaml` (it routes `orionmarkets.tech` and `www` to port 3202)
- [ ] Every page smoke-tested on chain 4663: no testnet addresses or faucet links, prices fresh, logos present, only the v1.0 markets listed
- [ ] The ORION token address published once the owner has launched it: `bash scripts/ops/set-token-ca.sh 0x…` on the VPS

Stable for 24 h before Phase 5.

### Phase 5: Enablement (owner broadcasts)

`node scripts/check-mainnet-readiness.mjs` is read-only and exits 1 until every v1.0 gate holds (run it on the VPS: the
API listens on `127.0.0.1`). It checks the release in `RELEASE_VERSION` (default 1): LeverageRouter and ShortRouter
open, AutoProtect and vault deposits still paused, every market NORMAL with a fresh price, margin routers open and the
liquidity floors (`MIN_POOL_USDG`, `MIN_PAIR_USDG`, `MIN_OWNER_ETH`). Run it before and after each step.

Steps 1 to 3 run in one go with `bash scripts/ops/open-mainnet-v1.sh` (each stage rehearsed on a fork, typed
confirmations, resumable).

1. **Seed tokens:** `node scripts/buy-mainnet-market-tokens.mjs --plan`, then with `MAINNET_SWAP_BROADCAST_ENABLED=true`
   in the profile `node scripts/buy-mainnet-market-tokens.mjs --run`, then set it back to `false`.
2. **Open the markets:** `bash scripts/enable-rh-mainnet-markets.sh` (fork rehearsal, then type `OPEN MARKETS`). Per
   market: caps, USDG into the long pair, stock into the short pair, pool seeded, margin router authorized and unpaused,
   long and short set NORMAL. To open one market first: `MAINNET_ENABLE_MARKETS=TSLA bash scripts/enable-rh-mainnet-markets.sh`, then the rest.
3. **Routers:** `bash scripts/ops/unpause-mainnet.sh`, then `bash scripts/ops/pause-mainnet-unused.sh`, which closes
   the vault and AutoProtect again: the vault holds deposits without a strategy (Earn is v3.0) and Auto-Protect is v2.0.
4. **Website:** `bash scripts/ops/enable-mainnet-web.sh on` on the VPS (`off` is the emergency switch). It writes the
   schema-validated values of `node scripts/generate-mainnet-app-config.mjs --launch` and rebuilds the site. Leave
   `TRADING_ENABLED=false`: the web schema rejects it together with lending or margin. Short exposure is 0.5x and 0.6x of
   margin because the mainnet short markets cap LTV at 40%.
5. Readiness script again, then a supervised deposit, borrow, repay, withdraw, long and short with small amounts per market.

6. **Leverage 2x/5x/10x:** `bash scripts/ops/raise-mainnet-leverage.sh` (fork rehearsal of the parameters and of every
   2x/5x/10x open and close, then type `RAISE LEVERAGE`; 20 transactions, about $0.10), then
   `bash scripts/ops/enable-mainnet-web.sh on` on the VPS. Per pair: liquidation bonus 1%; per market: max LTV 94%,
   liquidation LTV 97%, max leverage 10x, as on testnet. `generate-mainnet-app-config.mjs` offers 2x/5x/10x on a market
   only once both its pairs are at 94%, so the website never offers a multiple the chain would reject. On nano pools the
   largest 10x margin is about 0.0001 USDG (rehearsed: 0.0001 passes, 0.0005 reverts with "Borrow exceeds Max LTV
   limit"); 2x and 5x pass at 0.0005. A 10x position is liquidated after a move of about 7%: run the liquidator
   (`mainnet-watch.mjs --liquidate` from a separate hot wallet, Phase 6).

Pons and Earn stay hidden while `PONS_DEPLOYMENT_JSON` is unset
(`apps/web/src/lib/pons-visible.ts`, `earn-visible.ts`).

### Phase 6: Monitoring

**Watcher and liquidator.** `node scripts/mainnet-watch.mjs` follows every pair in the record to learn each borrower,
then re-reads each borrower's health from the chain every 30 seconds. It alerts on an unreadable oracle price, a project
wallet under `WATCH_MIN_OWNER_ETH`, a borrower under health 1.2 and a liquidatable borrower (stdout, plus
`WATCH_WEBHOOK_URL` if set). `--once` runs a single pass and exits 1 while an alert is active. Install it with
`bash scripts/ops/install-watch-service.sh`. With `--liquidate` and `LIQUIDATOR_PRIVATE_KEY` it also liquidates, but only
from a **separate hot wallet** holding gas ETH and the debt tokens; it refuses the project owner key.

Watch logs, HTTP error rate and oracle freshness (mainnet prices come from the Chainlink feeds in
`scripts/mainnet-full-deploy.config.json`; there is no price publisher on mainnet). Review caps at 24 h and 72 h; raise them only by
a transaction from the project wallet.

## 3. Later releases

- **v2.0** (SPY, QQQ, SGOV, SLV, BABA; 2x/5x/10x; Auto-Protect): each market is added with
  `bash scripts/add-rh-mainnet-market.sh <SYMBOL>` (deploy, buy tokens, open; `MAINNET_ENABLE_SIZE=nano` for a small
  wallet), then `enable-mainnet-web.sh on` and promotion. Prerequisites are in [`RELEASES.md`](RELEASES.md).
- **v3.0** (Pons, Earn): `pnpm rh:mainnet:pons:plan` → `:run` → `:verify`. `scripts/mainnet-pons-deploy.config.json`
  needs the ORION token's Pons address first (the deploy refuses an empty token). `supabase/mainnet-catalog.sql` writes the
  Earn row with the vault address from the record (instructions in the file).

## 4. Address registry

Filled by Phase 1: `packages/contracts/deployments/mainnet-4663.json` is the only source of ORION mainnet addresses.
`pnpm -s mainnet:verify` lists them with their explorer links.

### Showing the verification on camera

```bash
PS1='$ '                    # once, so the prompt that returns at the end shows no directory
pnpm -s mainnet:verify      # -s hides pnpm's banner, which prints the directory
```

`scripts/check-mainnet-verified.mjs` is read-only. It checks every ORION address on chain and on Sourcify (exact match, and each proxy must point at the listed implementation), checks the Uniswap V2 factory and pools against the vendored Uniswap V2 bytecode, and ends with the explorer link of each contract. It clears the screen and scrollback first, replaces the terminal title, and scrubs the current directory, the home directory and the user name from everything it prints. Add `--no-clear` to keep the screen, `--fast` to skip the pauses, `--plain` for no colours. The Blockscout mainnet API is behind a bot challenge, so the explorer itself cannot be queried from a script; the links open in a browser.

## 5. Emergency runbook

Trigger on any of: stale or wrong oracle, unexpected liquidation, abnormal outflow, an exploit report.

1. **Stop the UI path:** `bash scripts/ops/enable-mainnet-web.sh off` on the VPS.
2. **Pause on chain** from the project wallet: all markets (registry), routers, vault deposits, AutoProtect.
3. **Preserve exits:** markets in `REDUCE_ONLY` still allow repay and withdraw. Prefer it over a hard pause when users need to unwind.
4. Collect evidence (transactions, oracle rounds, logs) before changing anything else.
5. Unpause one market at a time after the cause is understood and a supervised test passes.
