#!/usr/bin/env node
// OrionMarkets: are the testnet contracts verified on the explorer?
//
// Read-only. Reads the deployment record, asks the Robinhood Chain testnet RPC that every address
// really holds code, then asks the Blockscout explorer whether the Solidity source behind each
// address is published and verified. Ends with the list of contracts and their explorer URLs.
//
// Built to be screen-recorded: one clear step at a time, plain-English captions, no secrets.
// Nothing it prints reveals where the repo lives on your machine: file locations are shown by file name only.
//
// Usage:  node scripts/check-testnet-verified.mjs [--fast] [--plain] [--record <file>]
//   --fast    no pauses between lines (CI or a quick look)
//   --plain   no colours or symbols that need a unicode font (NO_COLOR is honoured too)
//   --record  deployment record to read (default: packages/contracts/deployments/testnet-46630.json,
//             or the copy on the `testnet` branch when that file is not in your checkout)
// Exit code: 0 when every contract is verified, 1 otherwise.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const args = process.argv.slice(2);
const FAST = args.includes("--fast") || !process.stdout.isTTY;
const PLAIN = args.includes("--plain");
const COLOR = !process.env.NO_COLOR && !PLAIN && process.stdout.isTTY;
const recordArg = args.indexOf("--record");
const RECORD_PATH =
  recordArg >= 0
    ? args[recordArg + 1]
    : "packages/contracts/deployments/testnet-46630.json";

const RPC_URL = "https://rpc.testnet.chain.robinhood.com";
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const CHAIN_ID = 46630;

// ---- terminal styling ------------------------------------------------------------------------
const c = (code) => (s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = c("1"), dim = c("2"), green = c("32"), red = c("31"), yellow = c("33"), cyan = c("36"), white = c("97");
const OK = PLAIN ? "[OK]" : "✔";
const NO = PLAIN ? "[X]" : "✘";
const LINE = (PLAIN ? "-" : "─").repeat(78);
const pause = (ms) => (FAST ? Promise.resolve() : sleep(ms));
const out = (s = "") => console.log(s);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`.replace("…", PLAIN ? ".." : "…");
const shownFile = (p) => basename(p); // never print a directory: it would expose the local working path
const url = (a) => `${EXPLORER}/address/${a}?tab=contract`;

// ---- deployment record -----------------------------------------------------------------------
function loadRecord() {
  if (existsSync(RECORD_PATH)) return { json: JSON.parse(readFileSync(RECORD_PATH, "utf8")), source: shownFile(RECORD_PATH) };
  try {
    const text = execFileSync("git", ["show", `testnet:${RECORD_PATH}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return { json: JSON.parse(text), source: `branch testnet:${shownFile(RECORD_PATH)}` };
  } catch {
    console.error(`Cannot find the deployment record (${shownFile(RECORD_PATH)}). Check out the testnet branch or pass --record <file>.`);
    process.exit(2);
  }
}

// What each contract does, in words a first-time viewer can follow.
const ABOUT = {
  OrionMarketRegistry: "Registry of every market and its risk limits",
  OrionRouter: "Entry point: supply, borrow, repay, withdraw",
  LeverageRouter: "One-transaction leveraged long positions",
  ShortRouter: "One-transaction short positions",
  AutoProtectModule: "Deleverages a position before it can be liquidated",
  OrionVault: "ERC-4626 yield vault that issues oUSDG",
  OrionPair: "Isolated lending market for one asset pair",
  MarginRouter: "Margin trading: open and close long or short",
  RhTestnetReferenceOracle: "Testnet price oracle fed with real Robinhood prices",
  RhShortReferenceOracle: "Inverse price oracle for the short market",
  UniswapV2Factory: "Swap pool factory used by margin trades (Uniswap V2)",
  UniswapV2Pair: "TSLA/USDG swap pool used by margin trades (Uniswap V2)",
};

// One entry per contract; a proxy has two addresses (the proxy users call, and the logic behind it).
function contractList(rec) {
  const list = [];
  const proxy = (title, d, about) =>
    list.push({ title, name: d.contract, about: about ?? ABOUT[d.contract], addresses: [
      { label: "proxy", address: d.proxy, expect: "ERC1967Proxy" },
      { label: "implementation", address: d.implementation, expect: d.contract },
    ] });
  const single = (title, name, address, about) =>
    list.push({ title, name, about: about ?? ABOUT[name], addresses: [{ label: "contract", address, expect: name }] });
  const { core, margin } = rec;
  proxy("OrionMarketRegistry", core.registry);
  proxy("OrionRouter", core.router);
  proxy("LeverageRouter", core.leverageRouter);
  proxy("ShortRouter", core.shortRouter);
  proxy("AutoProtectModule", core.autoProtect);
  proxy("OrionVault", core.vault);
  proxy("OrionPair · TSLA long", core.longPair, "Isolated market: TSLA collateral, USDG debt");
  single("RhTestnetReferenceOracle", "RhTestnetReferenceOracle", core.oracle.address);
  proxy("OrionPair · TSLA short", margin.shortPair, "Isolated market: USDG collateral, TSLA debt");
  single("RhShortReferenceOracle", "RhShortReferenceOracle", margin.shortOracle.address);
  proxy("MarginRouter", margin.router);
  single("Uniswap V2 Factory", "UniswapV2Factory", margin.uniswapV2Factory.address);
  single("Uniswap V2 Pool · TSLA/USDG", "UniswapV2Pair", margin.pool.address);
  return list;
}

// ---- network helpers -------------------------------------------------------------------------
async function getJson(u, init, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { ...init, signal: AbortSignal.timeout(20000) });
      if (r.status === 404) return { notFound: true };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      last = e;
      await sleep(600 * (i + 1));
    }
  }
  throw last;
}
const rpc = async (method, params = []) => {
  const j = await getJson(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (j.error) throw new Error(j.error.message);
  return j.result;
};
// Blockscout verifies one proxy directly and marks every proxy with identical bytecode as its "twin":
// the source is published and readable on each of them, but the flag is only set on the first one.
const twinCache = new Map();
async function explorerStatus(address) {
  const j = await getJson(`${EXPLORER}/api/v2/smart-contracts/${address}`);
  if (j.notFound) return { verified: false };
  let verified = j.is_verified === true, twin = null;
  if (!verified && j.verified_twin_address_hash && j.source_code) {
    const t = j.verified_twin_address_hash;
    if (!twinCache.has(t)) twinCache.set(t, (await getJson(`${EXPLORER}/api/v2/smart-contracts/${t}`)).is_verified === true);
    if (twinCache.get(t)) { verified = true; twin = t; }
  }
  return {
    verified,
    twin,
    name: j.name ?? null,
    compiler: j.compiler_version ?? null,
    optimized: j.optimization_enabled ?? null,
    verifiedAt: j.verified_at ?? null,
  };
}

// An unexpected error would otherwise print a stack trace full of absolute local paths.
const fail = (e) => {
  console.error(`Unexpected error: ${e?.message ?? e}`);
  process.exit(2);
};
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

// ---- run -------------------------------------------------------------------------------------
const { json: rec, source } = loadRecord();
const contracts = contractList(rec);
const total = contracts.reduce((n, k) => n + k.addresses.length, 0);

out();
out(bold(white("  ORION PROTOCOL")) + dim("  ·  Testnet contract verification"));
out(dim("  " + LINE));
out(`  ${dim("Question")}   Can anyone read the source code behind every Orion contract on the explorer?`);
out(`  ${dim("Network")}    Robinhood Chain Testnet (chain id ${CHAIN_ID})`);
out(`  ${dim("Explorer")}   ${EXPLORER}`);
out(`  ${dim("Record")}     ${source}`);
out(dim("  " + LINE));
await pause(1200);

out();
out(bold(cyan("  STEP 1  ")) + bold("Connect to the chain"));
const chainId = parseInt(await rpc("eth_chainId"), 16);
const block = parseInt(await rpc("eth_blockNumber"), 16);
if (chainId !== CHAIN_ID) {
  out(red(`  ${NO} The RPC reports chain id ${chainId}, expected ${CHAIN_ID}. Stopping.`));
  process.exit(1);
}
out(`  ${green(OK)} Connected. Chain id ${bold(chainId)}, latest block ${bold(block.toLocaleString("en-US"))}`);
await pause(1200);

out();
out(bold(cyan("  STEP 2  ")) + bold(`Check ${contracts.length} contracts (${total} addresses): live code on chain + verified source on the explorer`));
out(dim("  A proxy is the address users call; its implementation holds the logic. Both must be verified."));
out();
await pause(1200);

let verifiedCount = 0;
const problems = [];
let index = 0;
for (const k of contracts) {
  index++;
  out(`  ${bold(String(index).padStart(2, " "))}  ${bold(white(k.title))}`);
  out(`      ${dim(k.about)}`);
  for (const a of k.addresses) {
    let line, ok = false;
    try {
      const code = await rpc("eth_getCode", [a.address, "latest"]);
      const hasCode = typeof code === "string" && code.length > 2;
      const s = await explorerStatus(a.address);
      a.status = s;
      if (!hasCode) line = `${red(NO)} no code on chain`;
      else if (!s.verified) line = `${red(NO)} ${red("NOT verified")}`;
      else if (a.expect && s.name !== a.expect) line = `${yellow("!")} verified as ${s.name}, expected ${a.expect}`;
      else {
        ok = true;
        const twinNote = s.twin ? dim(`  ·  same code as ${short(s.twin)}`) : "";
        line = `${green(OK)} ${green("verified")} ${dim("as")} ${bold(s.name)}${s.compiler ? dim(`  ·  ${s.compiler.replace(/^v/, "solc ").replace(/\+commit.*/, "")}`) : ""}${twinNote}`;
      }
    } catch (e) {
      line = `${red(NO)} could not reach the explorer (${e.message})`;
    }
    a.ok = ok;
    if (ok) verifiedCount++;
    else problems.push(`${k.title} (${a.label}) ${a.address}`);
    out(`      ${dim(a.label.padEnd(15))} ${short(a.address)}  ${line}`);
    await pause(280);
  }
  out();
}

// ---- verdict and list ------------------------------------------------------------------------
out(dim("  " + LINE));
const allOk = verifiedCount === total;
out(allOk
  ? `  ${green(bold(`${OK} ALL VERIFIED`))}   ${bold(`${verifiedCount} of ${total}`)} addresses have public, verified source code.`
  : `  ${red(bold(`${NO} NOT ALL VERIFIED`))}   ${bold(`${verifiedCount} of ${total}`)} addresses verified; ${problems.length} need attention.`);
out(dim("  " + LINE));
await pause(1500);

out();
out(bold(cyan("  STEP 3  ")) + bold("Contracts and explorer links") + dim("  (open the link, then the “Code” tab)"));
out();
for (const k of contracts) {
  const mark = k.addresses.every((a) => a.ok) ? green(OK) : red(NO);
  out(`  ${mark} ${bold(white(k.title))}`);
  for (const a of k.addresses) {
    const tag = k.addresses.length > 1 ? dim(`${a.label}:`.padEnd(16)) : "";
    out(`      ${tag}${cyan(url(a.address))}`);
  }
  await pause(150);
}
out();
out(dim(`  Checked ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC at block ${block.toLocaleString("en-US")}. Read-only: no transaction was sent.`));
if (!allOk) {
  out();
  out(yellow("  Needs attention:"));
  for (const p of problems) out(yellow(`   - ${p}`));
}
out();
process.exit(allOk ? 0 : 1);
