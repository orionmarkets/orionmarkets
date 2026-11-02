# Mainnet deployment budget

**Result (dry run, 2026-10-15): about $2.89 of gas for everything including the optional Pons stack and a keeper reserve, $3.61 with a 25% buffer. The core deployment alone is about $1.19.** The target was $6 to $7; gas is well under it. What is left of that budget pays for seed liquidity tokens, which are not gas and are listed separately below.

This replaces the earlier estimate ($5.24 / $6.55). That one used a gas figure from a different rehearsal and an L1 factor of 1.56 that the chain does not confirm; both are corrected below.

## How it was measured

1. **Rehearsal on a mainnet fork.** `node scripts/deploy-rh-mainnet-full.mjs --plan` ran the whole deployment against a local anvil fork of mainnet. No mainnet transaction was sent. Result: **PASSED, 45 transactions, 22,905,462 gas** (28 deployments, 8 market registrations, 8 pauses, 1 router authorization), for the four launch markets TSLA, AMZN, PLTR and AMD.
2. **L1 data cost, measured on the live chain.** Robinhood Chain is an Arbitrum Orbit chain, so each transaction also pays for posting its data to Ethereum, which a fork does not meter. `eth_estimateGas` on the mainnet RPC for the nine implementation deployments returned **13,580,486 gas against 13,463,129 on the fork: 1.009x**, about 1.9 extra gas per byte. The old 1.56 factor was wrong by roughly 1.5x.
3. **Live prices.** Gas price 0.0213 gwei (`eth_gasPrice`), ETH/USD $2,426.77 (Chainlink feed `0x78F3…d3A9`, read on-chain).

| Line item | Gas | ETH | USD |
| :--- | ---: | ---: | ---: |
| Core deploy: registry, router, vault, oracle, 4 markets long+short, 4 margin routers (45 tx) | 22.91 M | 0.00049 | $1.19 |
| NVDA market added after launch (2 pairs, 2 registers, 2 pauses, margin router) | 1.84 M | 0.00004 | $0.10 |
| Enablement: unpause markets, routers, vault, AutoProtect (about 15 tx, estimated) | 0.68 M | 0.00001 | $0.04 |
| Pons perp stack and market listing (optional, 10 tx, earlier fork figure) | 6.70 M | 0.00014 | $0.35 |
| Operating reserve for keeper / Auto-Protect transactions (fixed) | | 0.00050 | $1.21 |
| **Subtotal** | | **0.00119** | **$2.89** |
| **With 25% buffer** | | **0.00149** | **$3.61** |
| If gas price doubles | | 0.00188 | $4.56 |

Scenarios, with a 25% buffer: core deploy only $1.49; plus NVDA and enablement $1.65; plus the keeper reserve $3.17; plus Pons $3.61.

## What is not in the gas figure

- **Seed liquidity tokens** for the first market: about $4.42 for a micro-sized market in an earlier rehearsal. Not re-measured. Gas plus this seed lands near the $6 to $7 target (for example $1.65 + $4.42 = $6.07, or $3.17 + $4.42 = $7.59 with the keeper reserve).
- Domain, hosting and database subscriptions.
- Confidence: the 45 deployments and calls are fork-measured and the nine implementations are checked against the live chain. The proxy deployments and calls (small payloads) use the same factor; the enablement line and the NVDA line are estimates by analogy with the same rehearsal.

## Findings that matter for the real deployment

- **The v1 record was missing.** The deploy script reuses the Uniswap V2 factory and the pools from the earlier mainnet deployment and reads them from `packages/contracts/deployments/mainnet-4663-v1.json`, which no longer existed in the repo. It was rebuilt from the chain by replaying the creation nonces of `0xd09D…9a7C`: factory `0xF3e3F49BCF467FC2b710ab9997AF53aA0f1cED02` (nonce 317) and five pools (TSLA, AMZN, PLTR, AMD, NVDA). Review it before committing it to the `mainnet` branch.
- **Those pools are not empty.** The script comment says so, but each pool holds micro reserves (about 0.25 USDG against 0.0007 TSLA for the TSLA pool, near the live TSLA price). The margin routers will sit on pools with existing liquidity.
- **The deployer wallet is not new.** `0xd09D…9a7C` has nonce 887 on mainnet and 0.00022 ETH. It created the factory above. To cover the keeper-reserve scenario with buffer (0.0013 ETH in total) it needs a top-up of about 0.0011 ETH (about $2.6); to cover everything including Pons (0.0015 ETH), about 0.0013 ETH (about $3.1).
- The rehearsal used a throwaway key; the real key was never used. Its profile and journal were deleted.

## Using it

```bash
node scripts/estimate-mainnet-budget.mjs          # table; exit code 2 if over the band
node scripts/estimate-mainnet-budget.mjs --json   # machine-readable
RPC_URL_MAINNET=https://<your-provider> node scripts/estimate-mainnet-budget.mjs
```

Edit `scripts/mainnet-budget.plan.json` to change the band, buffer, calibration or line items. Re-measure with `pnpm rh:mainnet:full:plan` (read-only, needs `.env.mainnet.core.local` and the v1 record) before you broadcast, then rerun the estimator.

## Funding checklist

- [ ] Deployer wallet `0xd09D…9a7C` holds at least **0.0015 ETH** on chain 4663 (about $3.6 at today's price). It has 0.00022 ETH now.
- [ ] Seed tokens for the first market are in the same wallet (USDG and the stock token).
- [ ] Gas price is near 0.02 gwei at the time of broadcast. If it is above 0.04 gwei, wait.
- [ ] Gas caps in `.env.mainnet.core.local` (`MAINNET_MAX_TOTAL_GAS_WEI` and friends) are set from this table, not left blank.
- [ ] `mainnet-4663-v1.json` is reviewed and committed on the `mainnet` branch.
