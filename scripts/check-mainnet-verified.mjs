#!/usr/bin/env node
// OrionMarkets: are the MAINNET contracts verified?
//
// Read-only. Reads the mainnet deployment record, asks the Robinhood Chain mainnet RPC that every address really
// holds code, then asks Sourcify (the public source-verification registry that the Robinhood Chain explorer reads)
// whether the Solidity source behind each Orion address is published as an exact match. A proxy must also point at
// the implementation that the record lists. The Uniswap V2 factory and pools are standard third-party code that
// this release reuses; they are checked by comparing their on-chain bytecode with the Uniswap V2 source vendored
// in this repository. Ends with the list of contracts and their explorer links.
//
// Built to be screen-recorded:
//   * The screen (and its scrollback) is cleared first, so the shell prompt and the command that started the
//     script, which show your working directory, disappear from the recording.
//   * The terminal title is replaced, and every line the script prints is scrubbed of the current directory,
//     the home directory and the user name. It never prints a file path.
//   * Record it with a short prompt (`PS1='$ '`) so the prompt that returns at the end shows no path either.
//
// Usage:  node scripts/check-mainnet-verified.mjs [--fast] [--plain] [--no-clear]
//         pnpm -s mainnet:verify          (-s hides pnpm's own banner, which prints the directory)
//   --fast       no pauses between lines
//   --plain      no colours or symbols that need a unicode font (NO_COLOR is honoured too)
//   --no-clear   do not clear the screen
// Exit code: 0 when everything checks out, 1 otherwise.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const args = process.argv.slice(2);
const TTY = Boolean(process.stdout.isTTY);
const FAST = args.includes("--fast") || !TTY;
const PLAIN = args.includes("--plain");
const COLOR = !process.env.NO_COLOR && !PLAIN && TTY;

// ---- privacy: never show where this is running ----------------------------------------------------
const user = (() => { try { return userInfo().username; } catch { return ""; } })();
// longest first, so the working directory is replaced before the home directory it lives in
const replacements = [[process.cwd(), "."], [homedir(), "~"], [user, "user"]]
  .filter(([s]) => s && s.length > 2)
  .sort((a, b) => b[0].length - a[0].length);
const scrub = (text) => replacements.reduce((t, [s, to]) => t.split(s).join(to), String(text));
const rawLog = console.log.bind(console);
console.log = (...a) => rawLog(...a.map((x) => (typeof x === "string" ? scrub(x) : x)));
console.error = (...a) => process.stderr.write(a.map((x) => scrub(typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n");
process.on("uncaughtException", (e) => {
  console.error(`\nCheck stopped: ${scrub(e?.message ?? e)}`);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error(`\nCheck stopped: ${scrub(e?.message ?? e)}`);
  process.exit(1);
});
if (TTY && !args.includes("--no-clear")) {
  // clear screen + scrollback, move home; then replace the window title (many terminals show the directory there)
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H\x1b]0;OrionMarkets · mainnet verification\x07");
}

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const SOURCIFY = "https://sourcify.dev/server";
const CHAIN_ID = 4663;
const RECORD_FILE = "packages/contracts/deployments/mainnet-4663.json";
const UNI_BUILD = "packages/contracts/vendor/uniswap-v2-core/build";

// ---- terminal styling ------------------------------------------------------------------------
const c = (code) => (s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = c("1"), dim = c("2"), green = c("32"), red = c("31"), yellow = c("33"), cyan = c("36"), white = c("97");
const OK = PLAIN ? "[OK]" : "✔";
const NO = PLAIN ? "[X]" : "✘";
const LINE = (PLAIN ? "-" : "─").repeat(78);
const pause = (ms) => (FAST ? Promise.resolve() : sleep(ms));
const out = (s = "") => console.log(s);
const short = (a) => `${a.slice(0, 6)}${PLAIN ? ".." : "…"}${a.slice(-4)}`;
const url = (a) => `${EXPLORER}/address/${a}?tab=contract`;

// ---- deployment record (read from the checkout, or from the `mainnet` branch; no path is ever printed) ----
function loadRecord() {
  if (existsSync(RECORD_FILE)) return { json: JSON.parse(readFileSync(RECORD_FILE, "utf8")), source: "mainnet-4663.json" };
  try {
    const text = execFileSync("git", ["show", `mainnet:${RECORD_FILE}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return { json: JSON.parse(text), source: "mainnet-4663.json (branch mainnet)" };
  } catch {
    console.error("Cannot find the mainnet deployment record. Run this inside the OrionMarkets repository, or check out the mainnet branch.");
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
  VerifiedFeedOracle: "Price oracle reading Chainlink feeds with staleness and range guards",
  OrionPair: "Isolated lending market for one asset pair",
  MarginRouter: "Margin trading: open and close long or short",
};

// proxy check: the proxy must be an ERC1967Proxy that Sourcify resolves to the listed implementation.
function buildList(rec) {
  const a = rec.addresses;
  const markets = Object.keys(rec.markets); // deployment order
  const proxy = (title, name, address, implAddress, about) => ({
    title, about: about ?? ABOUT[name], kind: "orion", addresses: [
      { label: "proxy", address, expect: "ERC1967Proxy", pointsTo: { address: implAddress, name } },
    ] });
  const impl = (title, name, address, about) => ({ title, about: about ?? ABOUT[name], kind: "orion", addresses: [{ label: "implementation", address, expect: name }] });
  const list = [];
  const pairs = [
    ["OrionMarketRegistry", "registry", "impl-OrionMarketRegistry"],
    ["OrionRouter", "lendingRouter", "impl-OrionRouter"],
    ["LeverageRouter", "leverageRouter", "impl-LeverageRouter"],
    ["ShortRouter", "shortRouter", "impl-ShortRouter"],
    ["AutoProtectModule", "autoProtect", "impl-AutoProtectModule"],
    ["OrionVault", "vault", "impl-OrionVault"],
    ["VerifiedFeedOracle", "oracle", "impl-VerifiedFeedOracle"],
  ];
  for (const [name, role, implRole] of pairs) {
    const k = proxy(name, name, a[role], a[implRole]);
    k.addresses.push({ label: "implementation", address: a[implRole], expect: name });
    list.push(k);
  }
  list.push(impl("OrionPair implementation", "OrionPair", a["impl-OrionPair"], "Shared logic behind every market contract below"));
  for (const m of markets) {
    const s = m.toLowerCase();
    list.push(proxy(`OrionPair · ${m} long`, "OrionPair", a[`long-${s}`], a["impl-OrionPair"], `Isolated market: ${m} collateral, USDG debt`));
    list.push(proxy(`OrionPair · ${m} short`, "OrionPair", a[`short-${s}`], a["impl-OrionPair"], `Isolated market: USDG collateral, ${m} debt`));
  }
  list.push(impl("MarginRouter implementation", "MarginRouter", a["impl-MarginRouter"], "Shared logic behind every margin router below"));
  for (const m of markets) list.push(proxy(`MarginRouter · ${m}`, "MarginRouter", a[`margin-${m.toLowerCase()}`], a["impl-MarginRouter"], `Margin trading for ${m}`));
  // Uniswap V2 (standard third-party code, deployed by ORION for its margin pools)
  const infra = [{ title: "Uniswap V2 Factory", about: "Swap-pool factory the margin routers use (Uniswap V2, deployed by ORION)", kind: "uniswap", addresses: [{ label: "contract", address: a.v2Factory, build: "UniswapV2Factory" }] }];
  for (const m of markets) infra.push({ title: `Uniswap V2 Pool · ${m}/USDG`, about: "Swap pool behind the margin router (Uniswap V2, created by ORION)", kind: "uniswap", addresses: [{ label: "contract", address: a[`pool-${m.toLowerCase()}`], build: "UniswapV2Pair" }] });
  return [...list, ...infra];
}

// ---- network helpers -------------------------------------------------------------------------
async function getJson(u, init, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { ...init, signal: AbortSignal.timeout(25000) });
      if (r.status === 404) return { notFound: true, body: await r.json().catch(() => ({})) };
      if (r.status === 429) throw new Error("rate limited");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.error?.code === 429 || /too many/i.test(j?.error?.message ?? "")) throw new Error("rate limited");
      return j;
    } catch (e) {
      last = e;
      await sleep(900 * (i + 1));
    }
  }
  throw last;
}
const rpc = async (method, params = []) => {
  const j = await getJson(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (j.error) throw new Error(j.error.message);
  return j.result;
};
async function sourcify(address) {
  // Sourcify is occasionally slow to answer or briefly reports "no match" for a contract it holds; ask again before
  // declaring a contract unverified, so a hiccup does not turn a recording red.
  let j;
  for (let attempt = 0; attempt < 4; attempt++) {
    j = await getJson(`${SOURCIFY}/v2/contract/${CHAIN_ID}/${address}?fields=compilation,proxyResolution`);
    if (!j.notFound && j.match) break;
    await sleep(1500 * (attempt + 1));
  }
  if (j.notFound || !j.match) return { exact: false };
  return {
    exact: j.match === "exact_match",
    match: j.match,
    name: j.compilation?.name ?? null,
    compiler: j.compilation?.compilerVersion ?? null,
    impls: (j.proxyResolution?.implementations ?? []).map((i) => ({ address: i.address.toLowerCase(), name: i.name })),
  };
}
const uniswapRuntime = Object.fromEntries(["UniswapV2Factory", "UniswapV2Pair"].map((n) => {
  const p = `${UNI_BUILD}/${n}.json`;
  let text = existsSync(p) ? readFileSync(p, "utf8") : null;
  if (!text) { try { text = execFileSync("git", ["show", `HEAD:${p}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { text = null; } }
  return [n, text ? "0x" + JSON.parse(text).evm.deployedBytecode.object.replace(/^0x/, "").toLowerCase() : null];
}));

// ---- run -------------------------------------------------------------------------------------
const { json: rec, source } = loadRecord();
const contracts = buildList(rec);
const orionTotal = contracts.filter((k) => k.kind === "orion").reduce((n, k) => n + k.addresses.length, 0);
const uniTotal = contracts.filter((k) => k.kind === "uniswap").reduce((n, k) => n + k.addresses.length, 0);

out();
out(bold(white("  ORION PROTOCOL")) + dim("  ·  Mainnet contract verification"));
out(dim("  " + LINE));
out(`  ${dim("Question")}   Can anyone read the source code behind every Orion contract on mainnet?`);
out(`  ${dim("Network")}    Robinhood Chain (chain id ${CHAIN_ID})`);
out(`  ${dim("Registry")}   Sourcify (public source verification; the explorer reads it)`);
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
out(bold(cyan("  STEP 2  ")) + bold(`Check ${orionTotal} Orion addresses: live code on chain + exact-match source on Sourcify`));
out(dim("  A proxy is the address users call; its implementation holds the logic. Both must match, and the proxy must point at the right one."));
out();
await pause(1200);

let orionOk = 0, uniOk = 0;
const problems = [];
let index = 0;
let printedInfra = false;
for (const k of contracts) {
  if (k.kind === "uniswap" && !printedInfra) {
    printedInfra = true;
    out(dim("  " + LINE));
    out(bold(cyan("  UNISWAP V2")) + dim("  Standard Uniswap V2 code, deployed by ORION for its margin pools. Checked against the Uniswap V2 source in the repo."));
    out();
    await pause(900);
  }
  index++;
  out(`  ${bold(String(index).padStart(2, " "))}  ${bold(white(k.title))}`);
  out(`      ${dim(k.about)}`);
  for (const a of k.addresses) {
    let line, ok = false;
    try {
      const code = (await rpc("eth_getCode", [a.address, "latest"])).toLowerCase();
      const hasCode = code.length > 2;
      if (!hasCode) line = `${red(NO)} no code on chain`;
      else if (k.kind === "uniswap") {
        const same = uniswapRuntime[a.build] && code === uniswapRuntime[a.build];
        ok = Boolean(same);
        line = same ? `${green(OK)} ${green("verified")} ${dim("bytecode identical to Uniswap V2 core (")}${bold(a.build)}${dim(")")}` : `${red(NO)} bytecode differs from Uniswap V2 core`;
      } else {
        const s = await sourcify(a.address);
        a.status = s;
        if (!s.exact) line = `${red(NO)} ${red("NOT verified")} ${s.match ? dim(`(only a ${s.match})`) : ""}`;
        else if (a.expect && s.name !== a.expect) line = `${yellow("!")} verified as ${s.name}, expected ${a.expect}`;
        else if (a.pointsTo && !s.impls.some((i) => i.address === a.pointsTo.address.toLowerCase())) line = `${red(NO)} proxy does not point at ${short(a.pointsTo.address)}`;
        else {
          ok = true;
          const ptr = a.pointsTo ? dim(`  ·  runs ${a.pointsTo.name} ${short(a.pointsTo.address)}`) : "";
          line = `${green(OK)} ${green("verified")} ${dim("exact match")} ${dim("as")} ${bold(s.name)}${s.compiler ? dim(`  ·  solc ${s.compiler.replace(/\+commit.*/, "")}`) : ""}${ptr}`;
        }
      }
    } catch (e) {
      line = `${red(NO)} could not reach the service (${scrub(e.message)})`;
    }
    a.ok = ok;
    if (ok) (k.kind === "orion" ? orionOk++ : uniOk++);
    else problems.push(`${k.title} (${a.label}) ${a.address}`);
    out(`      ${dim(a.label.padEnd(15))} ${short(a.address)}  ${line}`);
    await pause(250);
  }
  out();
}

// ---- verdict and list ------------------------------------------------------------------------
out(dim("  " + LINE));
const allOk = orionOk === orionTotal && uniOk === uniTotal;
out(allOk
  ? `  ${green(bold(`${OK} ALL VERIFIED`))}   ${bold(`${orionOk} of ${orionTotal}`)} Orion addresses match their published source; ${bold(`${uniOk} of ${uniTotal}`)} reused Uniswap V2 addresses are the standard bytecode.`
  : `  ${red(bold(`${NO} NOT ALL VERIFIED`))}   Orion ${bold(`${orionOk} of ${orionTotal}`)}, Uniswap ${bold(`${uniOk} of ${uniTotal}`)}; ${problems.length} need attention.`);
out(dim("  " + LINE));
await pause(1500);

out();
out(bold(cyan("  STEP 3  ")) + bold("Contracts and explorer links") + dim("  (open the link, then the “Contract” tab)"));
out();
for (const k of contracts) {
  const mark = k.addresses.every((a) => a.ok) ? green(OK) : red(NO);
  out(`  ${mark} ${bold(white(k.title))}`);
  for (const a of k.addresses) {
    const tag = k.addresses.length > 1 ? dim(`${a.label}:`.padEnd(16)) : "";
    out(`      ${tag}${cyan(url(a.address))}`);
  }
  await pause(90);
}
out();
out(dim(`  Checked ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC at block ${block.toLocaleString("en-US")}. Read-only: no transaction was sent.`));
if (!allOk) {
  out();
  out(yellow("  Needs attention:"));
  for (const p of problems) out(yellow(`   - ${p}`));
  out(dim("  Sourcify is occasionally intermittent. Re-run the check, or publish again with: node scripts/verify-rh-mainnet-sources.mjs"));
}
out();
process.exit(allOk ? 0 : 1);
