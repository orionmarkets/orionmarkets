#!/usr/bin/env node
// Builds upload files for the explorer's "Verify & Publish" form (Standard JSON input), for the contracts of the
// Robinhood Chain MAINNET deployment. Needed because the Blockscout mainnet API sits behind a bot challenge, so the
// explorer cannot be filled from a script; Sourcify already holds an exact match for every address.
//
// The Standard JSON input is the one Sourcify compiled and matched byte for byte, so the same input verifies on the
// explorer. Proxies all share one source; constructor arguments are recovered from each deployment transaction.
//
// Usage (from the mainnet checkout, where the deployment record lives):
//   node scripts/ops/build-explorer-bundles.mjs [--out <dir>]      default: .secrets/explorer-bundles/mainnet
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = outIdx >= 0 ? args[outIdx + 1] : ".secrets/explorer-bundles/mainnet";
const RPC = "https://rpc.mainnet.chain.robinhood.com";
const SOURCIFY = "https://sourcify.dev/server";
const RECORD_FILE = "packages/contracts/deployments/mainnet-4663.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const record = JSON.parse(
  existsSync(RECORD_FILE)
    ? readFileSync(RECORD_FILE, "utf8")
    : execFileSync("git", ["show", `mainnet:${RECORD_FILE}`], { encoding: "utf8" }),
);
const a = record.addresses;

async function getJson(url, init) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(40000) });
      if (r.ok) {
        const j = await r.json();
        if (!(j?.error?.code === 429)) return j;
      }
    } catch {}
    await sleep(1000 * (i + 1));
  }
  throw new Error(`request failed: ${url.split("?")[0]}`);
}
const rpc = (method, params) => getJson(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then((j) => j.result);

// Unique source units: the proxy source once (any proxy address works) and each implementation.
const units = [
  { file: "ERC1967Proxy", address: a.registry, note: "Used by all 19 proxies (7 core, 8 market pairs, 4 margin routers). Constructor arguments differ per proxy; see proxies-constructor-args.json." },
  { file: "OrionMarketRegistry", address: a["impl-OrionMarketRegistry"] },
  { file: "OrionRouter", address: a["impl-OrionRouter"] },
  { file: "AutoProtectModule", address: a["impl-AutoProtectModule"] },
  { file: "ShortRouter", address: a["impl-ShortRouter"] },
  { file: "OrionVault", address: a["impl-OrionVault"] },
  { file: "LeverageRouter", address: a["impl-LeverageRouter"] },
  { file: "VerifiedFeedOracle", address: a["impl-VerifiedFeedOracle"] },
  { file: "OrionPair", address: a["impl-OrionPair"], note: "Shared by all 8 market contracts." },
  { file: "MarginRouter", address: a["impl-MarginRouter"], note: "Shared by all 4 margin routers." },
];

mkdirSync(OUT, { recursive: true });
const rows = [];
for (const [i, u] of units.entries()) {
  const full = await getJson(`${SOURCIFY}/v2/contract/4663/${u.address}?fields=stdJsonInput,compilation`);
  if (!full.stdJsonInput || !full.compilation) throw new Error(`Sourcify has no match for ${u.file}`);
  const name = `${String(i + 1).padStart(2, "0")}-${u.file}.standard-input.json`;
  writeFileSync(`${OUT}/${name}`, JSON.stringify(full.stdJsonInput));
  const s = full.stdJsonInput.settings;
  rows.push({ n: i + 1, file: name, address: u.address, fqn: full.compilation.fullyQualifiedName, compiler: full.compilation.compilerVersion, evm: s.evmVersion, runs: s.optimizer?.runs, viaIR: s.viaIR === true, note: u.note });
}

// Constructor arguments of every proxy: deployment input minus the compiled creation bytecode of ERC1967Proxy.
const proxyArtifact = JSON.parse(readFileSync("packages/contracts/out/ERC1967Proxy.sol/ERC1967Proxy.json", "utf8")).bytecode.object.toLowerCase();
const proxyRoles = Object.keys(a).filter((k) => !k.startsWith("impl-") && !k.startsWith("pool-") && k !== "v2Factory");
const proxyArgs = {};
for (const role of proxyRoles) {
  const info = await getJson(`${SOURCIFY}/v2/contract/4663/${a[role]}?fields=deployment`);
  const tx = await rpc("eth_getTransactionByHash", [info.deployment.transactionHash]);
  const input = tx.input.toLowerCase();
  if (!input.startsWith(proxyArtifact)) throw new Error(`deployment input of ${role} differs from the compiled ERC1967Proxy`);
  proxyArgs[role] = { address: a[role], constructorArguments: `0x${input.slice(proxyArtifact.length)}` };
  await sleep(250);
}
writeFileSync(`${OUT}/proxies-constructor-args.json`, JSON.stringify(proxyArgs, null, 2) + "\n");

const md = [
  "# Mainnet explorer verification: upload files",
  "",
  "Open each address below on https://robinhoodchain.blockscout.com, go to the **Contract** tab and click **Verify & Publish**.",
  "Choose **Standard JSON input** and fill the form as follows. The same input verified byte for byte on Sourcify.",
  "",
  "- Compiler: the version in the table (Solidity, not Vyper)",
  "- EVM version: `cancun`  ·  Optimization: **enabled**, 200 runs  ·  The input already sets `viaIR`",
  "- License: MIT (or as you prefer)",
  "- Contract name: the fully qualified name from the table (path:Name) if the form asks for it, otherwise the plain name",
  "- Constructor arguments: leave empty for implementations. For the proxy, tick *auto-detect* or paste the value from `proxies-constructor-args.json`.",
  "- Upload the matching `*.standard-input.json`.",
  "",
  "| # | File | Address to verify | Contract | Compiler | EVM | Runs | viaIR |",
  "| :-: | :-- | :-- | :-- | :-- | :-: | :-: | :-: |",
  ...rows.map((r) => `| ${r.n} | \`${r.file}\` | \`${r.address}\` | \`${r.fqn}\` | ${r.compiler} | ${r.evm} | ${r.runs} | ${r.viaIR} |`),
  "",
  "Notes:",
  ...rows.filter((r) => r.note).map((r) => `- ${r.file}: ${r.note}`),
  "- The other 18 proxies have the same bytecode as the first; once one proxy is verified the explorer shows the rest as its twin, with the source readable on each page. If one does not, verify it with its own constructor arguments.",
  "",
].join("\n");
writeFileSync(`${OUT}/README.md`, md);
console.log(`Wrote ${units.length} Standard JSON inputs, proxies-constructor-args.json (${proxyRoles.length} proxies) and README.md to ${OUT}`);
