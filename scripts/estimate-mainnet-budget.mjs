#!/usr/bin/env node
// Read-only mainnet deployment budget estimate. Sends no transactions and needs no key.
//   node scripts/estimate-mainnet-budget.mjs            human-readable table
//   node scripts/estimate-mainnet-budget.mjs --json     machine-readable
// ETH/USD comes from the on-chain Chainlink feed (not a web API); gas price from the chain's own RPC.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/mainnet-budget.plan.json"), "utf8"));
const asJson = process.argv.includes("--json");
const rpcUrl = process.env.RPC_URL_MAINNET || plan.rpcUrl;

async function rpc(method, params = []) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}
const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);
const words = (hex) => hex.slice(2).match(/.{64}/g) ?? [];
const signed = (word) => BigInt.asIntN(256, BigInt("0x" + word));
const decodeString = (hex) => {
  const w = words(hex);
  const len = Number(BigInt("0x" + w[1]));
  return Buffer.from(hex.slice(2 + 128, 2 + 128 + len * 2), "hex").toString("utf8");
};

const chainId = Number(BigInt(await rpc("eth_chainId")));
if (chainId !== plan.chainId) throw new Error(`RPC is chain ${chainId}, expected ${plan.chainId}`);

const gasPriceWei = BigInt(await rpc("eth_gasPrice"));
const feed = plan.ethUsdFeed;
const description = decodeString(await call(feed, "0x7284e416")); // description()
const decimals = Number(BigInt(await call(feed, "0x313ce567"))); // decimals()
const round = words(await call(feed, "0xfeaf968c")); // latestRoundData()
const ethUsd = Number(signed(round[1])) / 10 ** decimals;
const updatedAt = Number(BigInt("0x" + round[3]));
const ageSeconds = Math.floor(Date.now() / 1000) - updatedAt;
if (!/ETH\s*\/\s*USD/i.test(description)) throw new Error(`Feed ${feed} is "${description}", expected ETH / USD`);
if (ageSeconds > plan.feedMaxAgeSeconds) throw new Error(`ETH/USD feed is stale (${ageSeconds}s old)`);

const gwei = Number(gasPriceWei) / 1e9;
const toEth = (gas, price = gasPriceWei) => (Number(gas) * Number(price) * plan.calibration.factor) / 1e18;
const usd = (eth) => eth * ethUsd;

const rows = [
  ...plan.gasLineItems.map((i) => ({ name: i.name, detail: `${(i.gas / 1e6).toFixed(2)}M gas`, eth: toEth(i.gas) })),
  ...plan.fixedEthLineItems.map((i) => ({ name: i.name, detail: "fixed", eth: i.eth })),
];
const subtotal = rows.reduce((s, r) => s + r.eth, 0);
const buffered = subtotal * (1 + plan.safetyBufferPct / 100);
const stressed = plan.gasLineItems.reduce((s, i) => s + toEth(i.gas, gasPriceWei * 2n), 0) +
  plan.fixedEthLineItems.reduce((s, i) => s + i.eth, 0);
const { min, max } = plan.targetBandUsd;
const verdict = usd(buffered) <= max ? "WITHIN BUDGET" : "OVER BUDGET";

const result = {
  generatedAt: new Date().toISOString(),
  chainId,
  gasPriceGwei: gwei,
  ethUsd,
  ethUsdFeed: { address: feed, description, ageSeconds },
  calibrationFactor: plan.calibration.factor,
  lineItems: rows.map((r) => ({ ...r, usd: usd(r.eth) })),
  subtotal: { eth: subtotal, usd: usd(subtotal) },
  withBuffer: { pct: plan.safetyBufferPct, eth: buffered, usd: usd(buffered) },
  gasPriceDoubled: { eth: stressed, usd: usd(stressed) },
  targetBandUsd: plan.targetBandUsd,
  verdict,
  excluded: plan.excluded,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const f = (n, d = 5) => n.toFixed(d);
  console.log(`OrionMarkets mainnet budget (chain ${chainId})`);
  console.log(`  gas price      ${f(gwei, 4)} gwei`);
  console.log(`  ETH/USD        $${f(ethUsd, 2)}  (${description}, ${feed}, ${ageSeconds}s old)`);
  console.log(`  L1 calibration x${plan.calibration.factor}\n`);
  for (const r of result.lineItems) console.log(`  ${r.name.padEnd(72)} ${r.detail.padStart(10)}  ${f(r.eth)} ETH  $${f(r.usd, 2)}`);
  console.log(`  ${"-".repeat(110)}`);
  console.log(`  ${"Subtotal".padEnd(72)} ${"".padStart(10)}  ${f(subtotal)} ETH  $${f(usd(subtotal), 2)}`);
  console.log(`  ${`With ${plan.safetyBufferPct}% safety buffer`.padEnd(72)} ${"".padStart(10)}  ${f(buffered)} ETH  $${f(usd(buffered), 2)}`);
  console.log(`  ${"If gas price doubles".padEnd(72)} ${"".padStart(10)}  ${f(stressed)} ETH  $${f(usd(stressed), 2)}`);
  console.log(`\n  Target band $${min}-$${max}: ${verdict}`);
  console.log(`  Fund the deployer with at least ${f(buffered)} ETH (~$${f(usd(buffered), 2)}).`);
  console.log(`  Not included: ${plan.excluded.join("; ")}.`);
}
process.exit(verdict === "WITHIN BUDGET" ? 0 : 2);
