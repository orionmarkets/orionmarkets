# Mainnet deployment budget (ORION v1.0)

**Result (fork rehearsal, 2026-11-03): the ORION v1.0 deploy is 58 transactions and 40.6 M gas, about 0.00082 ETH
($1.86). Opening the five markets adds about $0.13 of gas plus the seed tokens: about $5.4 at micro size, about $1.0 at
nano size.** ETH at $2,265.60 (Chainlink, on chain), gas price 0.020 gwei.

## How it was measured

1. **Rehearsal on a mainnet fork.** `node scripts/deploy-rh-mainnet-full.mjs --plan` ran the whole ORION deployment
   against a local anvil fork of mainnet, with a throwaway key (deleted afterwards). No mainnet transaction was sent.
   Result: **PASSED, 58 transactions, 40,571,609 gas**: 9 implementations, 7 core proxies, 10 market pairs (TSLA, AMZN,
   PLTR, AMD, NVDA, long and short), 10 registrations, 10 pauses, ORION's own Uniswap V2 factory, 5 pools, 5 margin
   routers and the lending router authorization. The largest single transaction is the factory (3.05 M gas).
2. **L1 data cost.** Robinhood Chain is an Arbitrum Orbit chain, so each transaction also pays for posting its data to
   Ethereum, which a fork does not meter. The live RPC measured 1.009x the fork gas (2026-10-15), so the estimator uses
   a 1.01 factor.
3. **Live prices** from the chain at the time of the run (`node scripts/estimate-mainnet-budget.mjs`).

| Line item | Gas | ETH | USD |
| :--- | ---: | ---: | ---: |
| ORION v1.0 deploy (58 tx) | 40.57 M | 0.00082 | $1.86 |
| Enablement of 5 markets (about 55 tx, estimated) | 2.75 M | 0.00006 | $0.13 |
| Pons perp stack (v3.0, optional, earlier fork figure) | 6.70 M | 0.00014 | $0.31 |
| Keeper / Auto-Protect reserve (v2.0) | | 0.00050 | $1.13 |
| **v1.0 gas (deploy + enablement), with 25% buffer** | | **0.00110** | **$2.49** |

## Seed tokens (not gas)

`buy-mainnet-market-tokens.mjs` buys them with the wallet's USDG and, for any USDG shortfall, with ETH. Per market
(plus 0.05 USDG spare once; stock bought with a 5% buffer):

| Size (`MAINNET_ENABLE_SIZE`) | USDG | Stock for the short pair | Stock for the pool | Five markets, about |
| :--- | ---: | ---: | ---: | ---: |
| micro (default) | 0.50 | 0.001 | $0.25 | $5.4 |
| nano | 0.10 | 0.0001 | $0.05 | $1.0 |

Tokens sent to the pairs stay there as lending liquidity; the pool LP tokens belong to the project wallet.

## Funding checklist (project wallet, chain 4663)

On 2026-11-03 the wallet holds **0.00466 ETH** and 0.075 USDG, and no stock tokens.

- [ ] Micro launch: about 0.0035 ETH in total (gas with buffer plus seed tokens). The wallet covers it with about
      0.0011 ETH left. Nano launch: about 0.0016 ETH in total.
- [ ] At least 0.0001 ETH stays in the wallet afterwards for emergency pauses (about 0.000002 ETH each).
- [ ] Gas price near 0.02 gwei at broadcast. Above 0.04 gwei (the profile's fee cap), wait.
- [ ] Gas caps in `.env.mainnet.core.local` come from `scripts/ops/init-mainnet-profile.sh` (sized from this rehearsal).

## Using it

```bash
node scripts/estimate-mainnet-budget.mjs          # table; exit code 2 if over the band
node scripts/estimate-mainnet-budget.mjs --json   # machine-readable
```

Edit `scripts/mainnet-budget.plan.json` to change the band, buffer, calibration or line items. Re-measure with
`pnpm rh:mainnet:full:plan` (read-only, needs `.env.mainnet.core.local`) right before you broadcast.
