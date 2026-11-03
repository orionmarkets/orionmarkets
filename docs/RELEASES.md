# ORIONMARKETS release plan (v1.0, v2.0, v3.0)

Status: **draft for owner review** (2026-11-03). Decided by the owner: ORION is launched on Pons by the owner and is not traded on this website.

## Principle

The release plan applies to **mainnet only**. Testnet and localnet always show every feature, whatever `RELEASE_VERSION` says.

Every release ships the same codebase. A version only changes what the website shows and what is unpaused on chain.

- All contracts for v1.0 to v3.0 may already be deployed on mainnet, **paused and with caps at 0** (`MAINNET.md`, mitigation 2).
- Contracts of a later version are hidden **on the website only**: not in `/contracts`, the landing contract group, docs,
  sitemap or menus. They are public on the chain explorer by nature, and this plan does not try to hide them there.
- Opening a version is: raise the release setting, unpause on chain, announce. No new build of features.

## Release setting (implemented in `apps/web/src/lib/release.ts`)

One setting, `RELEASE_VERSION` (`1`, `2` or `3`, default `1`), read by the web app; it has no effect unless `NETWORK_MODE=MAINNET`. Each feature, market and contract
group carries the minimum version that shows it. Existing gates stay and are combined with it, not replaced:
`LENDING_ENABLED`, `MARGIN_TRADING_ENABLED`, `PONS_VISIBLE` (`PONS_DEPLOYMENT_JSON`), `earn-visible`.

Surfaces that must filter by version: `/markets`, hero ring and tape (`CardLoop`, `Hero`), `ContractDirectory` and the
landing contract group, `/docs`, `sitemap.ts`, header and footer menus, `/api/reference-prices` (display only), and the
leverage options in `lib/leverage` and the margin policy.

## v1.0: mainnet launch

| Area | In v1.0 (visible) |
| :--- | :--- |
| Token | **ORION token**: launched by the owner on Pons. The website only shows the contract address chip (`NEXT_PUBLIC_TOKEN_CA`, no longer "Coming soon") and a link to its Pons page |
| Markets | TSLA, AMZN, PLTR, NVDA, AMD (isolated pair per equity, USDG) |
| Lending | Deposit, borrow, repay, withdraw (`LENDING_ENABLED`) |
| Margin | Long and short at 2x, 5x and 10x (`MARGIN_TRADING_ENABLED`). Decided by the owner (2026-11-03): opened in v1.0 on nano liquidity, so the largest 10x margin is about 0.0001 USDG per order (2x and 5x take more) |
| Vault | USDG ERC-4626 vault |
| Reporting | Portfolio, analytics, contracts directory (v1.0 contracts only) |

Hidden in v1.0, deployed paused where a contract exists: ETF markets, BABA, AutoProtect. Pons is not part of the protocol release.

ORION is launched by the owner on Pons, outside this repository's development, and is **not traded on this website**: no
ORION market, pair, pool, price feed, lending or margin. v1.0 ships no Pons contract and no Pons page; the ORION token is a
contract address and a link, not part of the Orion protocol.

Mainnet gates before v1.0 opens: Phase 0 to 5 of [`MAINNET.md`](MAINNET.md) (a fresh ORION deployment: no contract,
pool, market id or record from an earlier deployment is reused), the fork rehearsal of lending and margin, and owner
sign-off ([`BRANCHING.md`](BRANCHING.md)).

## v2.0: more markets and leverage

| Area | Opens in v2.0 |
| :--- | :--- |
| Markets | SPY, QQQ, SGOV, SLV (ETFs) and BABA (China) |
| Liquidity | Deeper pools, so 2x/5x/10x (open since v1.0) take real order sizes |
| AutoProtect | Module plus keeper, vault protection |

Status (2026-11-04): the five markets are deployed, opened (nano size) and verified on mainnet (46 of 46 Orion contracts on
Sourcify). SPY, QQQ, SGOV, SLV and BABA are `mainnetOnly` in `data/asset-catalog.json`: Robinhood has no testnet token for
them, so the testnet pair and acceptance run below cannot exist; the fork rehearsal against mainnet state (real tokens and
feeds, every stage of `add-rh-mainnet-market.sh`) replaces it. Wallet funds do not allow deeper pools or the Auto-Protect
keeper reserve yet. The website opens when `RELEASE_VERSION=2` is set on the VPS.

Prerequisites, all rehearsed on testnet first:
- ETF and BABA have only a reference price on testnet today. Each needs a testnet pair, pool and acceptance run before
  mainnet unpause.
- 10x needs no contract upgrade on mainnet (ORION deployed `OrionPair` with `setLiquidationBonus`); its parameters are
  set by `scripts/ops/raise-mainnet-leverage.sh`. Order size at 10x scales with pool depth (about 0.06 USDG of margin at
  26 USDG of liquidity, see the price-impact note in `TESTNET.md`).
- Keeper and price publisher run unattended and funded.
- Auto-Protect is **user-funded**: the keeper makes the module pull the repayment from the borrower's wallet (allowance
  to the module); it never spends its own funds and does not sell collateral. It is **live on testnet** (2026-11-03,
  see [`TESTNET.md`](TESTNET.md)): module upgraded and unpaused, rule screen on the Lending page, keeper running as
  `orion-keeper@testnet`, acceptance run passed. For mainnet, repeat per network: deploy the new module implementation and
  upgrade the proxy, unpause, authorize and fund a keeper wallet that is not the publisher's (`setKeeper`; testnet already uses a separate one), put `TRADING_ENABLED=true` and
  `AUTO_PROTECT_START_BLOCK` in `/opt/orion/mainnet/keeper.env`, start `orion-keeper@mainnet`, run the same acceptance
  with a borrower that is not the keeper, and then change `AUTOPROTECT_LIVE` in `apps/web/src/lib/release.ts` so mainnet
  counts as live. Until then mainnet landing and docs say "in validation" and the rule screen stays hidden.

## v3.0: Pons surfaces and expansion

| Area | Opens in v3.0 |
| :--- | :--- |
| Pons | Graduated market table, Pons perps, Pons leverage and vault panels, `PonsAutoProtectModule` (the in-app Pons product, separate from how ORION was launched) |
| Earn | Earn page (`earn-visible`) |

Pons data must be real before it opens: `data/pons-asset-catalog.json` currently lists placeholder tokens with dummy
addresses (`0x…0001` to `0x…0003`), and `addresses.json` holds localnet addresses. Both must come from the mainnet
deployment, never from fixtures.

## Opening a version: checklist

1. Contracts for the version are deployed, verified on the explorer and listed in the deployment record.
2. Testnet acceptance run passed for every new market or parameter.
3. Fork rehearsal against mainnet state, including the pause runbook.
4. Raise `RELEASE_VERSION`, merge `testnet` into `mainnet` ([`BRANCHING.md`](BRANCHING.md)), deploy.
5. Unpause one market at a time with caps raised in steps; supervised small-amount test per market.
6. Smoke-test every page on chain 4663: no testnet addresses, fresh prices, logos present.
7. Announce.

## Rollback

Every contract group can be paused by the owner. A version can be hidden again by lowering `RELEASE_VERSION`; this
changes the website only, so pause on chain first when funds are at risk.

## Budget (owner cap: USD 7)

Source: [`MAINNET_BUDGET.md`](MAINNET_BUDGET.md), fork rehearsal of the ORION v1.0 deploy on 2026-11-03, ETH at about
USD 2,266.

| Item | USD |
| :--- | ---: |
| Gas: v1.0 deploy (58 tx) and enablement of five markets, 25% buffer | 2.49 |
| Seed tokens, five markets at micro size (nano: about 1.0) | about 5.4 |
| **v1.0 at micro size** | **about 7.9** |
| **v1.0 at nano size** | **about 3.5** |

Micro size is just over the cap; nano size fits it with room for the keeper reserve of v2.0 (USD 1.13). The project
wallet holds 0.00466 ETH (about USD 10.6), which covers either. Not covered: the ORION launch on Pons, domain, hosting and
database. A pool this small limits position size (on testnet, 10x at 26 USDG of liquidity allows about 0.06 USDG of
margin), so v1.0 at this budget is a working launch, not a deep market.
