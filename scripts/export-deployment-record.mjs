#!/usr/bin/env node
// Writes the public deployment record for the testnet pipeline's journal.
//   node scripts/export-deployment-record.mjs [out=packages/contracts/deployments/testnet-46630.json]
// Reads .secrets/rh-live/state.json (gitignored). The record holds only public facts: addresses,
// implementations, code hashes, transaction hashes, blocks and fees. No keys, no env values.
import fs from "node:fs";
import path from "node:path";
import { chargedGasCost } from "./lib/rh-gas-ledger.mjs";

const out = process.argv[2] ?? "packages/contracts/deployments/testnet-46630.json";
const statePath = ".secrets/rh-live/state.json";
if (!fs.existsSync(statePath)) {
  console.error(`No journal at ${statePath}`);
  process.exit(1);
}
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
if (state.chainId !== 46630) throw new Error("Journal is not for chain 46630");
if (!state.acceptanceComplete) throw new Error("Core acceptance is not complete; refusing to record a partial deployment");

const proxy = (role, name) => ({
  contract: name,
  proxy: state[role],
  implementation: state[`${role}Implementation`],
  implementationCodeHash: state[`${role}CodeHash`],
});
const margin = state.margin ?? {};
const marginProxy = (role, name) => ({
  contract: name,
  proxy: margin[role],
  implementation: margin[`${role}Implementation`],
  runtimeCodeHash: margin[`${role}CodeHash`],
});

const operations = Object.entries(state.operations)
  .filter(([, op]) => op.receipt)
  .map(([id, op]) => ({
    id,
    from: op.from,
    hash: op.hash,
    block: Number(op.receipt.blockNumber),
    feeWei: String(chargedGasCost(op)),
  }))
  .sort((a, b) => a.block - b.block);
const totalFeeWei = operations.reduce((sum, op) => sum + BigInt(op.feeWei), 0n);
const deployer = Object.values(state.operations)[0]?.from;

const record = {
  network: "Robinhood Chain Testnet",
  chainId: 46630,
  explorer: "https://explorer.testnet.chain.robinhood.com",
  deployer,
  firstBlock: operations[0]?.block,
  lastBlock: operations.at(-1)?.block,
  status: "All markets paused; application execution flags off. Funded lending and margin acceptance passed.",
  tokens: {
    USDG: state.descriptor.debt,
    [state.descriptor.collateralSymbol]: state.descriptor.collateral,
  },
  core: {
    registry: proxy("registry", "OrionMarketRegistry"),
    router: proxy("router", "OrionRouter"),
    leverageRouter: proxy("leverageRouter", "LeverageRouter"),
    shortRouter: proxy("shortRouter", "ShortRouter"),
    autoProtect: proxy("autoProtect", "AutoProtectModule"),
    vault: proxy("orionVault", "OrionVault"),
    oracle: { contract: "RhTestnetReferenceOracle", address: state.oracle, runtimeCodeHash: state.oracleCodeHash },
    longPair: { ...proxy("pair", "OrionPair"), marketId: state.marketId },
  },
  margin: {
    uniswapV2Factory: { address: margin.factory, runtimeCodeHash: margin.factoryCodeHash },
    pool: { address: margin.pool, runtimeCodeHash: margin.poolCodeHash },
    shortOracle: { contract: "RhShortReferenceOracle", address: margin.shortOracle, runtimeCodeHash: margin.shortOracleCodeHash },
    shortPair: { ...marginProxy("shortPair", "OrionPair"), marketId: margin.descriptor?.marketId },
    router: marginProxy("router", "MarginRouter"),
  },
  lendingDescriptor: state.descriptor,
  transactions: { count: operations.length, totalFeeWei: String(totalFeeWei), list: operations },
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
console.log(`wrote ${out}: ${operations.length} transactions, total fee ${Number(totalFeeWei) / 1e18} ETH`);
