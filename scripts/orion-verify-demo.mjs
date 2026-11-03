#!/usr/bin/env node
// ORION V2.0: interactive mainnet contract verification, made for screen recording.
//
// Read-only. For every ORION mainnet contract it shows the name, the address and the explorer link, then
// checks live: code on chain (Robinhood Chain RPC) + exact-match source on Sourcify (what the explorer reads).
// Uniswap V2 pool contracts are compared with the Uniswap V2 bytecode vendored in this repo.
//
// Usage:  node scripts/orion-verify-demo.mjs [--fast] [--plain] [--no-clear]
//         pnpm -s mainnet:verify
//   --fast      no animation pauses
//   --plain     no colours and no unicode symbols (NO_COLOR is honoured too)
//   --no-clear  do not clear the screen
// Privacy: the screen is cleared first and every printed line is scrubbed of the working directory,
// home directory and user name. Record with a short prompt (PS1='$ ') so the prompt shows no path either.
//
// shortcut: the chain/Sourcify helpers are copied from check-mainnet-verified.mjs (it runs on import, so it
// cannot be imported); move both to scripts/lib if a third script needs them.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";

const args = process.argv.slice(2);
const TTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const FAST = args.includes("--fast") || !TTY;
const PLAIN = args.includes("--plain");
const COLOR = !process.env.NO_COLOR && !PLAIN && Boolean(process.stdout.isTTY);

// ---- privacy: never show where this is running ---------------------------------------------------
const user = (() => { try { return userInfo().username; } catch { return ""; } })();
const replacements = [[process.cwd(), "."], [homedir(), "~"], [user, "user"]]
  .filter(([s]) => s && s.length > 2)
  .sort((a, b) => b[0].length - a[0].length);
const scrub = (text) => replacements.reduce((t, [s, to]) => t.split(s).join(to), String(text));
const rawLog = console.log.bind(console);
console.log = (...a) => rawLog(...a.map((x) => (typeof x === "string" ? scrub(x) : x)));
const out = (s = "") => console.log(s);
const fatal = (e) => { process.stderr.write(`\nStopped: ${scrub(e?.message ?? e)}\n`); process.exit(1); };
process.on("uncaughtException", fatal);
process.on("unhandledRejection", fatal);
if (TTY && !args.includes("--no-clear")) process.stdout.write("\x1b[2J\x1b[3J\x1b[H\x1b]0;ORION V2.0 · contract verification\x07");

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const SOURCIFY = "https://sourcify.dev/server";
const CHAIN_ID = 4663;
const RECORD_FILE = "packages/contracts/deployments/mainnet-4663.json";
const UNI_BUILD = "packages/contracts/vendor/uniswap-v2-core/build";

// ---- styling -------------------------------------------------------------------------------------
const LIME = [176, 225, 53], BLUE = [65, 120, 255]; // the two logo colours
const sgr = (code) => (s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const rgb = ([r, g, b]) => sgr(`1;38;2;${r};${g};${b}`);
const bold = sgr("1"), dim = sgr("2"), green = sgr("32"), red = sgr("31"), yellow = sgr("33"), white = sgr("97");
const lime = rgb(LIME), blue = rgb(BLUE);
const OK = PLAIN ? "[OK]" : "✔", NO = PLAIN ? "[X]" : "✘";
const LINE = (PLAIN ? "-" : "─").repeat(74);
const pause = (ms) => (FAST ? Promise.resolve() : sleep(ms));
const link = (u) => (COLOR ? `\x1b]8;;${u}\x07${blue(u)}\x1b]8;;\x07` : u); // clickable in most terminals
const explorerUrl = (a) => `${EXPLORER}/address/${a}?tab=contract`;
const short = (a) => `${a.slice(0, 6)}${PLAIN ? ".." : "…"}${a.slice(-4)}`;

// ---- logo: the real mark (two lime bars, one blue bar), rasterised into half-block cells --------
const BARS = [
  [[213, 1668], [466, 958], [815, 788], [551, 1573]],
  [[642, 1560], [927, 737], [1276, 571], [978, 1466]],
  [[1087, 1449], [1404, 510], [1766, 337], [1442, 1339]],
];
const inPoly = (x, y, p) => {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
function logoLines(barsShown) {
  const COLS = 44, X0 = 190, Y0 = 320, cell = 1600 / COLS, rows = Math.ceil(1370 / cell / 2);
  const bar = (c, s) => {
    const k = BARS.findIndex((p) => inPoly(X0 + (c + 0.5) * cell, Y0 + (s + 0.5) * cell, p));
    return k < barsShown ? k : -1;
  };
  const fg = (k) => `\x1b[38;2;${(k === 2 ? BLUE : LIME).join(";")}m`;
  const bg = (k) => `\x1b[48;2;${(k === 2 ? BLUE : LIME).join(";")}m`;
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let line = "  ";
    for (let c = 0; c < COLS; c++) {
      const t = bar(c, 2 * r), b = bar(c, 2 * r + 1);
      if (t < 0 && b < 0) line += " ";
      else if (t === b) line += `${fg(t)}█\x1b[0m`;
      else if (b < 0) line += `${fg(t)}▀\x1b[0m`;
      else if (t < 0) line += `${fg(b)}▄\x1b[0m`;
      else line += `${fg(t)}${bg(b)}▀\x1b[0m`;
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines;
}
async function showLogo() {
  if (!COLOR) return out(bold("  ORION"));
  let drawn = 0;
  for (let k = FAST ? 3 : 1; k <= 3; k++) {
    const lines = logoLines(k);
    if (drawn) process.stdout.write(`\x1b[${drawn}A`);
    for (const l of lines) process.stdout.write(`${l}\x1b[K\n`);
    drawn = lines.length;
    await pause(450);
  }
}

// ---- spinner -------------------------------------------------------------------------------------
const FRAMES = PLAIN ? ["-", "\\", "|", "/"] : ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// Shows a spinner while `work` runs, then replaces the line with `done(result)`.
async function spin(label, work, done) {
  let i = 0, timer;
  if (TTY) timer = setInterval(() => process.stdout.write(`\r  ${lime(FRAMES[i++ % FRAMES.length])} ${label}\x1b[K`), 80);
  let res;
  try { res = await work; } finally { clearInterval(timer); }
  if (TTY) process.stdout.write("\r\x1b[K");
  await pause(350);
  out(`  ${done(res)}`);
  return res;
}

// ---- deployment record + contract list -----------------------------------------------------------
function loadRecord() {
  if (existsSync(RECORD_FILE)) return JSON.parse(readFileSync(RECORD_FILE, "utf8"));
  try {
    return JSON.parse(execFileSync("git", ["show", `mainnet:${RECORD_FILE}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    throw new Error("Cannot find the mainnet deployment record. Run this inside the OrionMarkets repository, or check out the mainnet branch.");
  }
}
const ABOUT = {
  OrionMarketRegistry: "Registry of every market and its risk limits",
  OrionRouter: "Entry point: supply, borrow, repay, withdraw",
  LeverageRouter: "One-transaction leveraged long positions",
  ShortRouter: "One-transaction short positions",
  AutoProtectModule: "Deleverages a position before it can be liquidated",
  OrionVault: "ERC-4626 yield vault that issues oUSDG",
  VerifiedFeedOracle: "Price oracle reading Chainlink feeds with staleness and range guards",
  OrionPair: "Isolated market for one asset pair",
  MarginRouter: "Margin trading: open and close long or short",
};
function buildList(rec) {
  const a = rec.addresses, markets = Object.keys(rec.markets), list = [];
  const proxy = (title, name, address, implAddress, about) => ({ title, about: about ?? ABOUT[name], kind: "orion", addresses: [
    { label: "proxy", address, expect: "ERC1967Proxy", pointsTo: { address: implAddress, name } },
    { label: "implementation", address: implAddress, expect: name },
  ] });
  const impl = (title, name, address, about) => ({ title, about: about ?? ABOUT[name], kind: "orion", addresses: [{ label: "implementation", address, expect: name }] });
  for (const [name, role] of [["OrionMarketRegistry", "registry"], ["OrionRouter", "lendingRouter"], ["LeverageRouter", "leverageRouter"], ["ShortRouter", "shortRouter"], ["AutoProtectModule", "autoProtect"], ["OrionVault", "vault"], ["VerifiedFeedOracle", "oracle"]])
    list.push(proxy(name, name, a[role], a[`impl-${name}`]));
  list.push(impl("OrionPair implementation", "OrionPair", a["impl-OrionPair"], "Shared logic behind every market contract below"));
  for (const m of markets) {
    const s = m.toLowerCase();
    list.push(proxy(`OrionPair · ${m} long`, "OrionPair", a[`long-${s}`], a["impl-OrionPair"], `Isolated market: ${m} collateral, USDG debt`));
    list.push(proxy(`OrionPair · ${m} short`, "OrionPair", a[`short-${s}`], a["impl-OrionPair"], `Isolated market: USDG collateral, ${m} debt`));
  }
  list.push(impl("MarginRouter implementation", "MarginRouter", a["impl-MarginRouter"], "Shared logic behind every margin router below"));
  for (const m of markets) list.push(proxy(`MarginRouter · ${m}`, "MarginRouter", a[`margin-${m.toLowerCase()}`], a["impl-MarginRouter"], `Margin trading for ${m}`));
  list.push({ title: "Uniswap V2 Factory", about: "Swap-pool factory the margin routers use (Uniswap V2)", kind: "uniswap", addresses: [{ label: "contract", address: a.v2Factory, build: "UniswapV2Factory" }] });
  for (const m of markets) list.push({ title: `Uniswap V2 Pool · ${m}/USDG`, about: "Swap pool behind the margin router (Uniswap V2)", kind: "uniswap", addresses: [{ label: "contract", address: a[`pool-${m.toLowerCase()}`], build: "UniswapV2Pair" }] });
  return list;
}

// ---- network -------------------------------------------------------------------------------------
async function getJson(u, init, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { ...init, signal: AbortSignal.timeout(25000) });
      if (r.status === 404) return { notFound: true };
      if (r.status === 429) throw new Error("rate limited");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.error?.code === 429 || /too many/i.test(j?.error?.message ?? "")) throw new Error("rate limited");
      return j;
    } catch (e) { last = e; await sleep(900 * (i + 1)); }
  }
  throw last;
}
const rpc = async (method, params = []) => {
  const j = await getJson(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (j.error) throw new Error(j.error.message);
  return j.result;
};
async function sourcify(address) {
  let j; // Sourcify sometimes answers "no match" for a contract it holds: ask again before calling it unverified
  for (let n = 0; n < 4; n++) {
    j = await getJson(`${SOURCIFY}/v2/contract/${CHAIN_ID}/${address}?fields=compilation,proxyResolution`);
    if (!j.notFound && j.match) break;
    await sleep(1500 * (n + 1));
  }
  if (j.notFound || !j.match) return { exact: false };
  return {
    exact: j.match === "exact_match", match: j.match, name: j.compilation?.name ?? null,
    compiler: j.compilation?.compilerVersion ?? null,
    impls: (j.proxyResolution?.implementations ?? []).map((i) => i.address.toLowerCase()),
  };
}
const uniswapRuntime = Object.fromEntries(["UniswapV2Factory", "UniswapV2Pair"].map((n) => {
  const p = `${UNI_BUILD}/${n}.json`;
  let text = existsSync(p) ? readFileSync(p, "utf8") : null;
  if (!text) { try { text = execFileSync("git", ["show", `HEAD:${p}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { text = null; } }
  return [n, text ? "0x" + JSON.parse(text).evm.deployedBytecode.object.replace(/^0x/, "").toLowerCase() : null];
}));

// ---- verify one address, with live output --------------------------------------------------------
async function verifyAddress(k, a) {
  const kindLabel = a.label === "contract" ? "" : ` · ${a.label}`;
  out();
  out(`  ${bold(white("Name"))}      ${lime(k.title)}${dim(kindLabel)}`);
  out(`  ${bold(white("About"))}     ${dim(k.about)}`);
  out(`  ${bold(white("Address"))}   ${bold(a.address)}`);
  out(`  ${bold(white("Explorer"))}  ${link(explorerUrl(a.address))}`);
  out();
  await pause(900);
  let code = "0x";
  try {
    code = (await spin("Checking code on chain…", rpc("eth_getCode", [a.address, "latest"]), (c) =>
      c.length > 2 ? `${green(OK)} Contract code found on chain ${dim(`(${((c.length - 2) / 2).toLocaleString("en-US")} bytes)`)}` : `${red(NO)} No code on chain`)).toLowerCase();
  } catch (e) { out(`  ${red(NO)} Chain unreachable (${scrub(e.message)})`); return false; }
  if (code.length <= 2) return false;

  if (k.kind === "uniswap") {
    const same = uniswapRuntime[a.build] && code === uniswapRuntime[a.build];
    await spin("Comparing with Uniswap V2 source…", pause(500), () =>
      same ? `${green(OK)} ${green("Verified")} ${dim("bytecode identical to Uniswap V2 core")} ${bold(a.build)}` : `${red(NO)} Bytecode differs from Uniswap V2 core`);
    return Boolean(same);
  }
  try {
    let ok = false;
    await spin("Checking source code on Sourcify…", sourcify(a.address), (s) => {
      if (!s.exact) return `${red(NO)} ${red("NOT verified")}${s.match ? dim(` (only a ${s.match})`) : ""}`;
      if (a.expect && s.name !== a.expect) return `${yellow("!")} Verified as ${s.name}, expected ${a.expect}`;
      if (a.pointsTo && !s.impls.includes(a.pointsTo.address.toLowerCase())) return `${red(NO)} Proxy does not point at ${short(a.pointsTo.address)}`;
      ok = true;
      const ptr = a.pointsTo ? dim(` · runs ${a.pointsTo.name} ${short(a.pointsTo.address)}`) : "";
      return `${green(OK)} ${green("Verified")} ${dim("exact match as")} ${bold(s.name)}${s.compiler ? dim(` · solc ${s.compiler.replace(/\+commit.*/, "")}`) : ""}${ptr}`;
    });
    return ok;
  } catch (e) { out(`  ${red(NO)} Sourcify unreachable (${scrub(e.message)})`); return false; }
}

// ---- interactive flow ----------------------------------------------------------------------------
const rl = TTY ? createInterface({ input: process.stdin, output: process.stdout }) : null; // no prompts without a terminal
rl?.on("close", () => process.exit(0));
const ask = (q) => new Promise((res) => rl.question(q, (v) => res(v.trim().toLowerCase())));

async function run(contracts, { step }) {
  let ok = 0, total = 0, auto = !step;
  const bad = [];
  for (const [i, k] of contracts.entries()) {
    out();
    out(dim("  " + LINE));
    out(`  ${blue(`CONTRACT ${i + 1} OF ${contracts.length}`)}`);
    for (const a of k.addresses) {
      total++;
      if (await verifyAddress(k, a)) ok++;
      else bad.push(`${k.title} (${a.label}) ${a.address}`);
      await pause(600);
    }
    if (!auto && i < contracts.length - 1) {
      const ans = await ask(`\n  ${lime("↵")} ENTER next contract · ${bold("a")} auto-run the rest · ${bold("q")} stop > `);
      if (ans === "q") break;
      if (ans === "a") auto = true;
    }
  }
  out();
  out(dim("  " + LINE));
  out(ok === total
    ? `  ${green(bold(`${OK} ALL VERIFIED`))}  ${bold(`${ok} of ${total}`)} addresses checked: source code is public and matches what is on chain.`
    : `  ${red(bold(`${NO} NEEDS ATTENTION`))}  ${bold(`${ok} of ${total}`)} verified. Re-run the check; Sourcify is sometimes slow.`);
  for (const b of bad) out(yellow(`   - ${b}`));
  out(dim("  " + LINE));
}

async function pickOne(list) {
  out();
  list.forEach((k, i) => out(`  ${lime(String(i + 1).padStart(2))}  ${k.title}`));
  const n = Number(await ask(`\n  Contract number (1-${list.length}) > `));
  return Number.isInteger(n) && n >= 1 && n <= list.length ? [list[n - 1]] : null;
}

// ---- start ---------------------------------------------------------------------------------------
const rec = loadRecord();
const list = buildList(rec);
const addrCount = list.reduce((n, k) => n + k.addresses.length, 0);

out();
await showLogo();
out();
out(`  ${lime("ORION")} ${blue("PROTOCOL")} ${bold(white("V2.0"))}  ${dim("·")}  ${bold("Smart contract verification")}`);
out(dim("  " + LINE));
out(`  ${dim("Network")}   Robinhood Chain mainnet ${dim(`(chain id ${CHAIN_ID})`)}`);
out(`  ${dim("Explorer")}  ${link(EXPLORER)}`);
out(`  ${dim("Question")}  Can anyone read the source code behind every ORION contract?`);
out(dim("  " + LINE));
await pause(1200);
out();
await spin("Connecting to Robinhood Chain…", Promise.all([rpc("eth_chainId"), rpc("eth_blockNumber")]), ([id, blk]) => {
  if (parseInt(id, 16) !== CHAIN_ID) throw new Error(`RPC reports chain id ${parseInt(id, 16)}, expected ${CHAIN_ID}`);
  return `${green(OK)} Connected · chain id ${bold(CHAIN_ID)} · block ${bold(parseInt(blk, 16).toLocaleString("en-US"))}`;
});
out(`  ${dim(`${list.length} contracts, ${addrCount} addresses to check. Nothing is sent to the chain: read-only.`)}`);

if (!TTY) { await run(list, { step: false }); process.exit(0); }
for (;;) {
  out();
  out(`  ${bold(white("What do you want to do?"))}`);
  out(`   ${lime("1")}  Verify all contracts, step by step ${dim("(press ENTER for each one)")}`);
  out(`   ${lime("2")}  Verify all contracts, automatic`);
  out(`   ${lime("3")}  Pick one contract`);
  out(`   ${lime("q")}  Quit`);
  const choice = await ask("\n  > ");
  if (choice === "q") break;
  const subset = choice === "3" ? await pickOne(list) : choice === "1" || choice === "2" ? list : null;
  if (!subset) { out(yellow("\n  Type 1, 2, 3 or q.")); continue; }
  await run(subset, { step: choice === "1" });
}
out(`\n  ${lime("ORION")} ${blue("V2.0")}  ${dim("·")}  Don't trust, verify.\n`);
process.exit(0);
