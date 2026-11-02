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
| Margin | Long and short, capped at 1.5x (`MARGIN_TRADING_ENABLED`) |
| Vault | USDG ERC-4626 vault |
| Reporting | Portfolio, analytics, contracts directory (v1.0 contracts only) |

Hidden in v1.0, deployed paused where a contract exists: ETF markets, BABA, 2x/5x/10x leverage, AutoProtect. Pons is not part of the protocol release.

ORION is launched by the owner on Pons, outside this repository's development, and is **not traded on this website**: no
ORION market, pair, pool, price feed, lending or margin. v1.0 ships no Pons contract and no Pons page; the ORION token is a
contract address and a link, not part of the Orion protocol.

Mainnet gates before v1.0 opens: Phase 0 to 6 of [`MAINNET.md`](MAINNET.md), fork rehearsal of lending and margin, and
owner sign-off ([`BRANCHING.md`](BRANCHING.md)).

## v2.0: more markets and leverage

| Area | Opens in v2.0 |
| :--- | :--- |
| Markets | SPY, QQQ, SGOV, SLV (ETFs) and BABA (China) |
| Leverage | 2x, 5x and 10x on long and short, per the testnet 10x update in [`TESTNET.md`](TESTNET.md) |
| AutoProtect | Module plus keeper, vault protection |

Prerequisites, all rehearsed on testnet first:
- ETF and BABA have only a reference price on testnet today. Each needs a testnet pair, pool and acceptance run before
  mainnet unpause.
- 10x needs the `OrionPair` upgrade (liquidation bonus setter, risk tiers 94% / 97%) on each mainnet pair, and pool depth
  that fits the largest margin (see the price-impact note in `TESTNET.md`).
- Keeper and price publisher run unattended and funded.
- Auto-Protect is **built but not live** today: the module is deployed on testnet and the keeper (`apps/keeper`) is
  written, but the keeper runs in standby (`TRADING_ENABLED` off), there is no systemd unit for it on the VPS, the app
  has no rule screen (`useAutoProtect` is unused), and `packages/contracts/test` has no AutoProtect test. All four are
  needed before v2.0 opens it. Set `AUTOPROTECT_LIVE = true` in `apps/web/src/lib/release.ts` when it is live; until then
  landing and docs say "in validation".

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

Source: [`MAINNET_BUDGET.md`](MAINNET_BUDGET.md), dry run 2026-10-15 on a mainnet fork, ETH at about USD 2,427.

| Item | USD |
| :--- | ---: |
| Gas: core (4 markets), NVDA, enablement, 25% buffer | 1.65 |
| Gas incl. keeper reserve (AutoProtect transactions) | 3.17 |
| Seed liquidity tokens, first market (micro size, not re-measured) | about 4.42 |
| **v1.0 contracts plus one seeded market** | **about 6.1 to 7.6** |

The cap covers gas and one micro-seeded market. It does not cover: seed liquidity for the other markets, the ORION launch on Pons, domain, hosting and database. A pool this small limits position size (on testnet, 10x at 26 USDG
of liquidity allows about 0.06 USDG of margin), so v1.0 at this budget is a working launch, not a deep market.
