#!/usr/bin/env node
// The three manual hand-offs between testnet pipeline stages, as repeatable, checked commands.
//   node scripts/testnet-glue.mjs base-manifest   after `rh-live --deploy-base`: write registry/router into PROTOCOL_ADDRESSES
//   node scripts/testnet-glue.mjs modules-config  before `rh-live --deploy-modules`: assemble RH_MODULES_CONFIG_JSON
//   node scripts/testnet-glue.mjs margin-plan     before `deploy-rh-margin`: write RH_MARGIN_PLAN_JSON (sized to the deployer's USDG)
//   node scripts/testnet-glue.mjs indexer-config  after margin acceptance: INDEXER_MARKETS_JSON (long + short pair) and INDEXER_POLICY_JSON
// Reads the journaled deployment state in .secrets/rh-live/state.json; edits only `.env.testnet` (mode 0600).
import fs from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";

const PROFILE = ".env.testnet";
const STATE = ".secrets/rh-live/state.json";
const cmd = process.argv[2];

function fail(message) {
  console.error(message);
  process.exit(1);
}
if (!["base-manifest", "modules-config", "margin-plan", "indexer-config"].includes(cmd)) {
  fail("Usage: node scripts/testnet-glue.mjs <base-manifest|modules-config|margin-plan|indexer-config>");
}
if ((fs.statSync(PROFILE).mode & 0o077) !== 0) fail(`${PROFILE} must be mode 0600`);
if (!fs.existsSync(STATE)) fail(`No deployment state at ${STATE}. Run the earlier pipeline stage first.`);

const env = parseEnv(fs.readFileSync(PROFILE, "utf8"));
const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
if (env.NETWORK_MODE !== "TESTNET" || env.CHAIN_ID !== "46630") fail("Profile is not the Robinhood testnet profile");

function setVar(name, value) {
  const line = `${name}='${value}'`;
  const text = fs.readFileSync(PROFILE, "utf8");
  const re = new RegExp(`^${name}=.*$`, "m");
  fs.writeFileSync(PROFILE, re.test(text) ? text.replace(re, line) : `${text.replace(/\n*$/, "\n")}${line}\n`);
  fs.chmodSync(PROFILE, 0o600);
}

// viem is a dependency of the workspace apps, not of the repo root; resolve it the way the other scripts do.
const require = createRequire(new URL("../apps/keeper/package.json", import.meta.url));
const { createPublicClient, http, keccak256, erc20Abi } = require("viem");
const client = createPublicClient({ transport: http(env.RPC_URL) });

if (cmd === "base-manifest") {
  if (!state.registry || !state.router) fail("Base contracts are not deployed yet (run rh-live --deploy-base)");
  const addresses = JSON.parse(env.PROTOCOL_ADDRESSES);
  addresses.registry = state.registry;
  addresses.orionRouter = state.router;
  setVar("PROTOCOL_ADDRESSES", JSON.stringify(addresses));
  console.log(`PROTOCOL_ADDRESSES updated: registry ${state.registry}, orionRouter ${state.router}`);
}

if (cmd === "modules-config") {
  if (!state.registry || !state.registryCodeHash || !state.router || !state.routerCodeHash) {
    fail("Base contracts are not deployed yet (run rh-live --deploy-base)");
  }
  const debtCode = await client.getCode({ address: env.USDG_ADDRESS });
  if (!debtCode || debtCode === "0x") fail("USDG has no code at USDG_ADDRESS on this RPC");
  const config = {
    registry: state.registry,
    registryCodeHash: state.registryCodeHash,
    lendingRouter: state.router,
    lendingRouterCodeHash: state.routerCodeHash,
    debt: env.USDG_ADDRESS,
    debtCodeHash: keccak256(debtCode),
    vaultName: "Orion USDG Yield Vault",
    vaultSymbol: "oUSDG",
    vaultSlug: "orion-usdg-vault-testnet",
    vaultRiskTier: "Conservative",
  };
  setVar("RH_MODULES_CONFIG_JSON", JSON.stringify(config));
  console.log("RH_MODULES_CONFIG_JSON written (vault: oUSDG, Conservative)");
}

if (cmd === "margin-plan") {
  const balance = await client.readContract({
    address: env.USDG_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [env.DEPLOYER_ADDRESS],
  });
  // Acceptance spends 5 USDG per side; keep that plus 5 USDG of headroom, seed the pool with the rest (max 40).
  const reserve = 15_000_000n;
  const seed = balance > reserve ? (balance - reserve > 40_000_000n ? 40_000_000n : balance - reserve) : 0n;
  if (seed < 10_000_000n) fail(`Deployer USDG too low for a margin pool (${Number(balance) / 1e6} USDG). Get USDG at ${env.USDG_FAUCET_URL}`);
  const plan = {
    version: 1,
    shortSlug: "orion-tsla-usdg-short-testnet",
    seedStableRaw: String(seed),
    maxSeedStockRaw: "500000000000000000",
    shortLiquidityRaw: "1000000000000000000",
    // A tenth of the pool keeps acceptance price impact inside the 50% max LTV at 1.5x (1 to 5 USDG).
    acceptanceMarginRaw: String(seed / 10n > 5_000_000n ? 5_000_000n : seed / 10n < 1_000_000n ? 1_000_000n : seed / 10n),
    shortSupplyCapRaw: "1000000000000000000000",
    shortBorrowCapRaw: "2000000000000000000",
    shortMaxLtvBps: 6000,
    shortLiquidationLtvBps: 8000,
    shortMaxLeverageBps: 12500,
    policy: {
      maxMarginRaw: "10000000",
      slippageBps: 50,
      deadlineSeconds: 120,
      gasBufferBps: 13000,
      maxGasLimit: "1500000",
      longLeveragesBps: [12500, 15000],
      shortExposureBps: [10000, 12500],
    },
  };
  setVar("RH_MARGIN_PLAN_JSON", JSON.stringify(plan));
  console.log(`RH_MARGIN_PLAN_JSON written: pool seed ${Number(seed) / 1e6} USDG (deployer holds ${Number(balance) / 1e6})`);
}

if (cmd === "indexer-config") {
  // Each pair is indexed from its own proxy deployment block, read from the journaled receipts.
  const blockOf = (operation) => String(BigInt(state.operations[operation]?.receipt?.blockNumber ?? 0));
  const longStart = blockOf("deploy-pair");
  const shortStart = blockOf("margin-v1-deploy-shortPair");
  if (!env.LENDING_DEPLOYMENT_JSON || !env.MARGIN_DEPLOYMENT_JSON || longStart === "0" || shortStart === "0")
    fail("Lending and margin deployments must be finalized first");
  const long = JSON.parse(env.LENDING_DEPLOYMENT_JSON);
  const margin = JSON.parse(env.MARGIN_DEPLOYMENT_JSON);
  setVar(
    "INDEXER_MARKETS_JSON",
    JSON.stringify([
      { symbol: long.collateralSymbol, side: "long", startBlock: longStart, deployment: long },
      { symbol: margin.short.debtSymbol, side: "short", startBlock: shortStart, deployment: margin.short },
    ]),
  );
  setVar("INDEXER_POLICY_JSON", JSON.stringify({ confirmations: 2, batchBlocks: 1000, maxBatches: 20, pollIntervalMs: 15000 }));
  console.log(`INDEXER_MARKETS_JSON written (${long.collateralSymbol} long from ${longStart}, short from ${shortStart})`);
}
