#!/usr/bin/env node
// Publishes the Solidity source of every Orion testnet contract to the Robinhood Chain testnet explorer
// (Blockscout), using `forge verify-contract`.
//
// For each address it reads the creation transaction, checks that the transaction's init code starts with
// the bytecode compiled from this checkout (so the published source is provably the deployed source), and
// passes the remaining bytes as the constructor arguments. Nothing is sent on chain; only source code goes
// to the explorer. Re-running is safe: addresses already verified are skipped.
//
// Usage: node scripts/verify-testnet-sources.mjs [--dry-run] [--only 0xAddress]
// Requires `forge` and `forge build` output in packages/contracts/out.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1].toLowerCase() : null;

const RPC_URL = "https://rpc.testnet.chain.robinhood.com";
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const CHAIN_ID = 46630;
const RECORD_PATH = "packages/contracts/deployments/testnet-46630.json";
const PROXY_SRC = "node_modules/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

const record = JSON.parse(
  existsSync(RECORD_PATH)
    ? readFileSync(RECORD_PATH, "utf8")
    : execFileSync("git", ["show", `testnet:${RECORD_PATH}`], { encoding: "utf8" }),
);

const SOURCE = {
  OrionMarketRegistry: "src/registry/OrionMarketRegistry.sol",
  OrionRouter: "src/routers/OrionRouter.sol",
  LeverageRouter: "src/routers/LeverageRouter.sol",
  ShortRouter: "src/routers/ShortRouter.sol",
  AutoProtectModule: "src/modules/AutoProtectModule.sol",
  OrionVault: "src/vaults/OrionVault.sol",
  OrionPair: "src/core/OrionPair.sol",
  MarginRouter: "src/trading/MarginRouter.sol",
  RhTestnetReferenceOracle: "src/oracle/RhTestnetReferenceOracle.sol",
  RhShortReferenceOracle: "src/trading/RhShortReferenceOracle.sol",
};

// Every address we deployed that forge can verify: [address, contract name, source file].
const targets = [];
const addProxy = (d) => {
  targets.push([d.proxy, "ERC1967Proxy", PROXY_SRC]);
  targets.push([d.implementation, d.contract, `${SOURCE[d.contract]}`]);
};
const { core, margin } = record;
for (const d of [core.registry, core.router, core.leverageRouter, core.shortRouter, core.autoProtect, core.vault, core.longPair, margin.shortPair, margin.router]) addProxy(d);
targets.push([core.oracle.address, core.oracle.contract, SOURCE[core.oracle.contract]]);
targets.push([margin.shortOracle.address, margin.shortOracle.contract, SOURCE[margin.shortOracle.contract]]);

const rpc = async (method, params) => {
  const r = await fetch(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
};
const explorer = async (path) => (await fetch(`${EXPLORER}${path}`)).json();
const artifactBytecode = (file, name) => {
  const base = file.split("/").pop();
  const p = `packages/contracts/out/${base}/${name}.json`;
  if (!existsSync(p)) throw new Error(`missing artifact ${p}; run forge build in packages/contracts`);
  return JSON.parse(readFileSync(p, "utf8")).bytecode.object.toLowerCase();
};

let verified = 0, skipped = 0, failed = 0;
for (const [address, name, file] of targets) {
  if (ONLY && address.toLowerCase() !== ONLY) continue;
  const label = `${name} ${address}`;
  const status = await explorer(`/api/v2/smart-contracts/${address}`);
  if (status.is_verified === true) { console.log(`skip     ${label} (already verified)`); skipped++; continue; }
  try {
    const info = await explorer(`/api/v2/addresses/${address}`);
    const creationHash = info.creation_tx_hash ?? info.creation_transaction_hash;
    if (!creationHash) throw new Error("explorer has no creation transaction for this address");
    const tx = await rpc("eth_getTransactionByHash", [creationHash]);
    const input = tx.input.toLowerCase();
    const compiled = artifactBytecode(file, name);
    if (!input.startsWith(compiled)) throw new Error("deployed init code differs from the bytecode compiled in this checkout");
    const ctorArgs = input.slice(compiled.length);
    const cmd = ["verify-contract", address, `${file}:${name}`, "--chain-id", String(CHAIN_ID), "--verifier", "blockscout", "--verifier-url", `${EXPLORER}/api/`, "--watch", ...(ctorArgs ? ["--constructor-args", `0x${ctorArgs}`] : [])];
    if (DRY) { console.log(`dry-run  ${label}\n         forge ${cmd.map((x) => (x.length > 70 ? x.slice(0, 66) + "…" : x)).join(" ")}`); continue; }
    const r = spawnSync("forge", cmd, { cwd: "packages/contracts", encoding: "utf8" });
    const text = `${r.stdout}${r.stderr}`;
    if (r.status === 0 && /verified|already/i.test(text)) { console.log(`verified ${label}`); verified++; }
    else { console.log(`FAILED   ${label}\n${text.split("\n").slice(-6).join("\n")}`); failed++; }
  } catch (e) {
    console.log(`FAILED   ${label}: ${e.message}`);
    failed++;
  }
}
// ---- vendored Uniswap V2 (solc 0.5.16): factory and the TSLA/USDG pool -----------------------
// forge cannot build these (old compiler, vendored npm package), so the standard-JSON input is assembled
// from the vendored sources and the compiler settings recorded in the package's own build metadata.
const UNI = "packages/contracts/vendor/uniswap-v2-core";
function uniswapStandardJson() {
  const meta = JSON.parse(JSON.parse(readFileSync(`${UNI}/build/UniswapV2Factory.json`, "utf8")).metadata);
  const sources = Object.fromEntries(Object.keys(meta.sources).map((p) => [p, { content: readFileSync(`${UNI}/${p}`, "utf8") }]));
  return {
    version: `v${meta.compiler.version}`,
    input: JSON.stringify({
      language: "Solidity",
      sources,
      settings: { optimizer: meta.settings.optimizer, evmVersion: meta.settings.evmVersion, libraries: {}, outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"] } } },
    }),
  };
}
async function verifyUniswap(address, name, ctorArgs) {
  const label = `${name} ${address}`;
  if ((await explorer(`/api/v2/smart-contracts/${address}`)).is_verified === true) { console.log(`skip     ${label} (already verified)`); skipped++; return; }
  const { version, input } = uniswapStandardJson();
  if (DRY) { console.log(`dry-run  ${label} via Blockscout standard-input, ${version}, ctor args ${ctorArgs ? ctorArgs.length / 2 - 1 : 0} bytes`); return; }
  const form = new FormData();
  form.append("compiler_version", version);
  form.append("license_type", "gnu_gpl_v3");
  form.append("contract_name", name);
  if (ctorArgs) form.append("constructor_args", ctorArgs);
  form.append("files[0]", new Blob([input], { type: "application/json" }), "standard-input.json");
  const r = await fetch(`${EXPLORER}/api/v2/smart-contracts/${address}/verification/via/standard-input`, { method: "POST", body: form });
  const reply = await r.text();
  if (!r.ok) { console.log(`FAILED   ${label}: HTTP ${r.status} ${reply.slice(0, 200)}`); failed++; return; }
  for (let i = 0; i < 30; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    if ((await explorer(`/api/v2/smart-contracts/${address}`)).is_verified === true) { console.log(`verified ${label}`); verified++; return; }
  }
  console.log(`FAILED   ${label}: explorer did not confirm verification within 90 s (${reply.slice(0, 120)})`);
  failed++;
}
if (!ONLY || ONLY === margin.uniswapV2Factory.address.toLowerCase() || ONLY === margin.pool.address.toLowerCase()) {
  try {
    const factoryAddr = margin.uniswapV2Factory.address;
    const info = await explorer(`/api/v2/addresses/${factoryAddr}`);
    const tx = await rpc("eth_getTransactionByHash", [info.creation_tx_hash ?? info.creation_transaction_hash]);
    const creation = readFileSync(`${UNI}/Factory.creation.txt`, "utf8").trim().toLowerCase();
    const input = tx.input.toLowerCase();
    if (!input.startsWith(creation)) throw new Error("deployed factory init code differs from the vendored creation code");
    const factoryArgs = input.slice(creation.length);
    if (!ONLY || ONLY === factoryAddr.toLowerCase()) await verifyUniswap(factoryAddr, "UniswapV2Factory", factoryArgs);
    if (!ONLY || ONLY === margin.pool.address.toLowerCase()) await verifyUniswap(margin.pool.address, "UniswapV2Pair", "");
  } catch (e) {
    console.log(`FAILED   Uniswap V2 (factory/pool): ${e.message}`);
    failed++;
  }
}

console.log(`\ndone: ${verified} verified, ${skipped} already verified, ${failed} failed${DRY ? " (dry run)" : ""}`);
process.exit(failed ? 1 : 0);
