# ORIONMARKETS on Robinhood Chain testnet (46630)

| | |
| :--- | :--- |
| Site | <https://testnet.orionmarkets.tech> |
| Explorer | <https://explorer.testnet.chain.robinhood.com> |
| Blocks | 147,072,174 to 147,080,193 |
| Tokens | USDG `0x7E955252E15c84f5768B83c41a71F9eba181802F`, TSLA `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` |

## Status: live (2026-11-02)

Deployed with the project wallet through the journaled pipeline below. 84 transactions, 0.000289 ETH of testnet gas.
All 22 addresses have verified source on Blockscout (`pnpm testnet:verify`).

| Stage | Result |
| :--- | :--- |
| Core lending (TSLA/USDG) | `FUNDED_LENDING_LIFECYCLE_PASSED`: seed liquidity, deposit, borrow, repay, withdraw; allowances back to zero |
| Margin (long and short) | Pool seeded with 11.68 USDG; a 1 USDG long at 1.5× and a short each opened and closed with zero debt, zero collateral, zero router dust |
| Live operation | Price publisher, indexer, web and API run as systemd services on the VPS ([`HOSTING.md`](HOSTING.md)) |

| Contract | Address (proxy) | Implementation |
| :--- | :--- | :--- |
| OrionMarketRegistry | [`0xa9e6…d1af`](https://explorer.testnet.chain.robinhood.com/address/0xa9e6ad391f357c6d55f87c39a4def6f6b5e4d1af) | [`0xcf19…983d`](https://explorer.testnet.chain.robinhood.com/address/0xcf195b209e6cd60a1eec96b503de1fe44e2e983d) |
| OrionRouter | [`0xa451…dc91`](https://explorer.testnet.chain.robinhood.com/address/0xa451de6096bc1929611a6ab7dd2aa5de5567dc91) | [`0x60a3…6607`](https://explorer.testnet.chain.robinhood.com/address/0x60a309d3e8610a726ff8bf8c46ae48005ac06607) |
| LeverageRouter | [`0xc3a5…ff79`](https://explorer.testnet.chain.robinhood.com/address/0xc3a56930fe93f687e420c9efe365688c055bff79) | [`0xb3c7…ed8e`](https://explorer.testnet.chain.robinhood.com/address/0xb3c7260264fe40b67212734c795332f2708eed8e) |
| ShortRouter | [`0xb4b4…0560`](https://explorer.testnet.chain.robinhood.com/address/0xb4b45bf18c43120f24e909a1b60093ef8c540560) | [`0x982f…4387`](https://explorer.testnet.chain.robinhood.com/address/0x982fc701618a3b44405742b997284724f4744387) |
| AutoProtectModule | [`0x28a0…6506`](https://explorer.testnet.chain.robinhood.com/address/0x28a0307be727594340b00048b912feb59d556506) | [`0xa5f3…6977`](https://explorer.testnet.chain.robinhood.com/address/0xa5f3528e79696c2319b5df36a3be34fb4b556977) |
| OrionVault | [`0x9ab7…df29`](https://explorer.testnet.chain.robinhood.com/address/0x9ab7fa06c0b50c8d23127c60ad183fe06ce3df29) | [`0x57c5…fdf0`](https://explorer.testnet.chain.robinhood.com/address/0x57c553b75fc5817e9d708d369e9b7507fe8cfdf0) |
| RhTestnetReferenceOracle | [`0xda41…4f44`](https://explorer.testnet.chain.robinhood.com/address/0xda41d1bdf4e1c8a01b20de9f0c1ecdf035de4f44) | not a proxy |
| OrionPair · TSLA long | [`0x945c…f567`](https://explorer.testnet.chain.robinhood.com/address/0x945c89d82dfa799bd57b2ffd48670fc4121df567) | [`0x90e5…ee47`](https://explorer.testnet.chain.robinhood.com/address/0x90e5a19b9a972bbb58f2656d8d95452447fcee47) |
| OrionPair · TSLA short | [`0xc0db…95f7`](https://explorer.testnet.chain.robinhood.com/address/0xc0db4c227f88bc00c623e7edabd2cf875b7295f7) | [`0xd418…2867`](https://explorer.testnet.chain.robinhood.com/address/0xd418a0775af944abe91decfe99d9ce3bb6e12867) |
| MarginRouter | [`0x7cfe…4f5b`](https://explorer.testnet.chain.robinhood.com/address/0x7cfe40aca7d4c20cf04063960e757ecc23654f5b) | [`0xbcd2…3adc`](https://explorer.testnet.chain.robinhood.com/address/0xbcd225d59681917007488bb23178541d0fe13adc) |
| RhShortReferenceOracle | [`0x0538…8309`](https://explorer.testnet.chain.robinhood.com/address/0x0538c74341fdfb7423dc4a11af481da66f358309) | not a proxy |
| Uniswap V2 pool TSLA/USDG | [`0x4b6C…D9E3`](https://explorer.testnet.chain.robinhood.com/address/0x4b6CdC36732889d5688B30C83e40c41443E4D9E3) | vendored V2 |
| Uniswap V2 factory | [`0x7d30…210f`](https://explorer.testnet.chain.robinhood.com/address/0x7d302e518b927f694160b767849a7accab43210f) | vendored V2 |

Machine-readable record: `packages/contracts/deployments/testnet-46630.json`; pipeline evidence in `docs/evidence/`.

## Pipeline

Run from the repository root with `.env.testnet` (git-ignored, mode 0600; `bash scripts/ops/load-deployer-key.sh` loads the
key from the Foundry keystore).

```bash
node --import tsx scripts/rh-live.mjs --prepare .env.testnet          # read-only
node --import tsx scripts/rh-live.mjs --check .env.testnet            # read-only: live reference quote
# RH_TESTNET_DEPLOYMENT_APPROVED='true'
node --import tsx scripts/rh-live.mjs --deploy-base .env.testnet
node scripts/testnet-glue.mjs base-manifest
# RH_REFERENCE_ORACLE_APPROVED='true'
node --import tsx scripts/rh-live.mjs --deploy-market .env.testnet
node scripts/testnet-glue.mjs modules-config
node --import tsx scripts/rh-live.mjs --deploy-modules .env.testnet
node --import tsx scripts/rh-live.mjs --acceptance .env.testnet
node --import tsx scripts/rh-live.mjs --close-acceptance .env.testnet
node --import tsx scripts/finalize-rh-deployment.mjs .env.testnet
node --import tsx scripts/rh-live.mjs --verify .env.testnet

node scripts/testnet-glue.mjs margin-plan                    # needs >= 25 USDG; acceptance margin = pool / 10
node --import tsx scripts/deploy-rh-margin.mjs .env.testnet
node --import tsx scripts/accept-rh-margin.mjs .env.testnet

node scripts/testnet-glue.mjs indexer-config                 # per-pair start blocks from the journal
node --import tsx scripts/run-rh-indexer.mjs --migrate .env.testnet
node scripts/export-deployment-record.mjs
pnpm testnet:verify:publish                                  # Blockscout source verification
```

`ORION_DEBUG=1` prints a sanitized one-line cause when a pipeline or indexer step fails (keys and long hex are redacted).

## Operations

- The publisher signs about one oracle update every 45 s (about 0.001 testnet ETH a day). Keep the project wallet topped
  up from the Robinhood testnet faucet.
- The public testnet RPC prunes old state; the indexer verifies each pair's start block from its ERC-1967 `Upgraded` log.
