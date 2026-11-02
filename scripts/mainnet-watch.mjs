import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";

// Mainnet watcher and optional liquidator for Robinhood Chain (4663). It needs no database: it follows the
// pairs' own events to learn every borrower, then re-reads each borrower's health from the chain.
//   node scripts/mainnet-watch.mjs                 watch forever, print alerts (poll every WATCH_POLL_SECONDS, default 30)
//   node scripts/mainnet-watch.mjs --once          one pass, exit 1 when an alert is active
//   node scripts/mainnet-watch.mjs --liquidate     also liquidate unhealthy borrowers from a SEPARATE wallet
// Environment (all optional):
//   RPC_URL                    default https://rpc.mainnet.chain.robinhood.com
//   WATCH_STATE_PATH           where the borrower list is cached (default .secrets/mainnet-watch/state.json)
//   WATCH_WEBHOOK_URL          POST {"text": ...} on every new alert (Slack, Discord-compatible)
//   WATCH_MIN_OWNER_ETH        alert when the project wallet holds less (default 0.0005)
//   WATCH_WARN_HEALTH_BPS      warn when health factor falls below this (default 12000 = 1.2)
//   LIQUIDATOR_PRIVATE_KEY     required with --liquidate; a dedicated hot wallet holding gas ETH plus the debt tokens
//                              (USDG for long pairs, the stock token for short pairs). Never the project owner key.
// The watcher never touches the AutoProtect module: that module repays borrowers' debt out of the caller's own
// funds, so it is not run here.
const require = createRequire(new URL("../apps/keeper/package.json", import.meta.url));
const v = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const RPC = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const once = process.argv.includes("--once");
const liquidate = process.argv.includes("--liquidate");
const pollMs = Number(process.env.WATCH_POLL_SECONDS ?? 30) * 1000;
const minOwnerEth = v.parseEther(process.env.WATCH_MIN_OWNER_ETH ?? "0.0005");
const warnHealth = BigInt(process.env.WATCH_WARN_HEALTH_BPS ?? 12000);
const webhook = process.env.WATCH_WEBHOOK_URL;
const statePath = process.env.WATCH_STATE_PATH || ".secrets/mainnet-watch/state.json";

const record = JSON.parse(readFileSync("packages/contracts/deployments/mainnet-4663.json", "utf8"));
const a = record.addresses;
const client = v.createPublicClient({ transport: v.http(RPC, { timeout: 60000 }) });

const pairAbi = v.parseAbi([
  "event DebtBorrowed(address indexed user, uint256 amount)",
  "event CollateralDeposited(address indexed user, uint256 amount)",
  "function accounts(address) view returns (uint256 collateral, uint256 debt)",
  "function getPosition(address) view returns (uint256 collateralAmount, uint256 debtAmount, uint256 collateralValueUsd, uint256 healthFactorBps)",
  "function isLiquidatable(address) view returns (bool)",
  "function liquidate(address borrower, uint256 maxDebtRepay)",
  "function debtToken() view returns (address)",
]);
const oracleAbi = v.parseAbi(["function getPrice(address) view returns (uint256)"]);

// Every pair with its deploy block, learned once from the deployment transactions.
const pairs = [];
for (const [symbol, market] of Object.entries(record.markets))
  for (const side of ["long", "short"]) {
    const s = symbol.toLowerCase();
    const receipt = await client.getTransactionReceipt({ hash: record.transactions[`deploy-${side}-${s}`] });
    pairs.push({ name: `${symbol} ${side}`, address: a[`${side}-${s}`], fromBlock: receipt.blockNumber });
  }
const tokens = [record.usdg, ...Object.values(record.markets).map((m) => m.token)];

let state = { pairs: {} };
if (existsSync(statePath)) state = JSON.parse(readFileSync(statePath, "utf8"));
function save() {
  mkdirSync(dirname(statePath), { recursive: true, mode: 0o700 });
  writeFileSync(`${statePath}.tmp`, JSON.stringify(state), { mode: 0o600 });
  renameSync(`${statePath}.tmp`, statePath);
}

let liquidator = null;
let liquidatorWallet = null;
if (liquidate) {
  if (!process.env.LIQUIDATOR_PRIVATE_KEY) throw Error("LIQUIDATOR_PRIVATE_KEY_REQUIRED");
  liquidator = privateKeyToAccount(process.env.LIQUIDATOR_PRIVATE_KEY);
  if (liquidator.address.toLowerCase() === record.owner.toLowerCase()) throw Error("LIQUIDATOR_MUST_NOT_BE_THE_OWNER_KEY");
  liquidatorWallet = v.createWalletClient({
    account: liquidator,
    chain: { id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } },
    transport: v.http(RPC, { timeout: 60000 }),
  });
}

const active = new Map(); // alert key -> message, to report each condition once
const stamp = () => new Date().toISOString().slice(11, 19);
async function raise(key, message) {
  if (active.has(key)) return;
  active.set(key, message);
  console.log(`${stamp()} ALERT  ${message}`);
  if (webhook) await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `Orion mainnet: ${message}` }) }).catch(() => {});
}
async function clear(key, message) {
  if (!active.delete(key)) return;
  console.log(`${stamp()} CLEAR  ${message}`);
  if (webhook) await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `Orion mainnet: ${message}` }) }).catch(() => {});
}

// New borrowers since the last pass, with the block range split in half whenever the node refuses a range.
async function scanEvents(pair, head) {
  const entry = (state.pairs[pair.address] ??= { next: String(pair.fromBlock), borrowers: [] });
  const known = new Set(entry.borrowers);
  let from = BigInt(entry.next);
  let span = 200000n;
  while (from <= head) {
    const to = from + span - 1n > head ? head : from + span - 1n;
    try {
      const logs = await client.getLogs({ address: pair.address, events: pairAbi.filter((x) => x.name === "DebtBorrowed" || x.name === "CollateralDeposited"), fromBlock: from, toBlock: to });
      for (const log of logs) known.add(log.args.user);
      from = to + 1n;
      entry.next = String(from);
      entry.borrowers = [...known];
    } catch (error) {
      if (span <= 1000n) throw error;
      span /= 2n;
    }
  }
  save();
  return entry.borrowers;
}

async function liquidatePosition(pair, borrower, debt) {
  const debtToken = await client.readContract({ address: pair.address, abi: pairAbi, functionName: "debtToken" });
  const balance = await client.readContract({ address: debtToken, abi: v.erc20Abi, functionName: "balanceOf", args: [liquidator.address] });
  const amount = debt < balance ? debt : balance;
  if (amount === 0n) return console.log(`${stamp()} LIQ    ${pair.name} ${borrower}: liquidator holds no ${debtToken}`);
  const allowance = await client.readContract({ address: debtToken, abi: v.erc20Abi, functionName: "allowance", args: [liquidator.address, pair.address] });
  if (allowance < amount) {
    const hash = await liquidatorWallet.writeContract({ address: debtToken, abi: v.erc20Abi, functionName: "approve", args: [pair.address, amount] });
    await client.waitForTransactionReceipt({ hash });
  }
  const { request } = await client.simulateContract({ account: liquidator, address: pair.address, abi: pairAbi, functionName: "liquidate", args: [borrower, amount] });
  const hash = await liquidatorWallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log(`${stamp()} LIQ    ${pair.name} ${borrower}: ${receipt.status} ${hash}`);
}

async function pass() {
  const head = await client.getBlockNumber();
  for (const token of tokens) {
    try {
      const price = await client.readContract({ address: a.oracle, abi: oracleAbi, functionName: "getPrice", args: [token] });
      await clear(`oracle:${token}`, `oracle price for ${token} is readable again (${Number(price) / 1e18})`);
    } catch {
      await raise(`oracle:${token}`, `oracle price for ${token} is unavailable or stale`);
    }
  }
  const eth = await client.getBalance({ address: record.owner });
  if (eth < minOwnerEth) await raise("owner-gas", `project wallet holds ${v.formatEther(eth)} ETH (below ${v.formatEther(minOwnerEth)})`);
  else await clear("owner-gas", `project wallet gas restored (${v.formatEther(eth)} ETH)`);

  let borrowersWithDebt = 0;
  for (const pair of pairs) {
    const borrowers = await scanEvents(pair, head);
    for (const borrower of borrowers) {
      let position;
      try {
        position = await client.readContract({ address: pair.address, abi: pairAbi, functionName: "getPosition", args: [borrower] });
      } catch {
        continue; // no readable price right now: the oracle alert already covers it
      }
      const [, debt, , health] = position;
      if (debt === 0n) {
        await clear(`risk:${pair.address}:${borrower}`, `${pair.name} ${borrower} repaid`);
        continue;
      }
      borrowersWithDebt++;
      const key = `risk:${pair.address}:${borrower}`;
      if (health < 10000n) {
        await raise(key, `${pair.name} ${borrower} is LIQUIDATABLE (health ${Number(health) / 10000})`);
        if (liquidate)
          try {
            await liquidatePosition(pair, borrower, debt);
          } catch (error) {
            console.log(`${stamp()} LIQ    ${pair.name} ${borrower}: failed (${error.shortMessage ?? error.message})`);
          }
      } else if (health < warnHealth) await raise(key, `${pair.name} ${borrower} is near liquidation (health ${Number(health) / 10000})`);
      else await clear(key, `${pair.name} ${borrower} is healthy again (health ${Number(health) / 10000})`);
    }
  }
  console.log(`${stamp()} OK     block ${head}, ${pairs.length} pairs, ${borrowersWithDebt} open debts, ${active.size} active alerts`);
}

do {
  try {
    await pass();
  } catch (error) {
    console.log(`${stamp()} ERROR  pass failed (${error.shortMessage ?? error.message})`);
    if (once) process.exit(2);
  }
  if (once) process.exit(active.size ? 1 : 0);
  await new Promise((r) => setTimeout(r, pollMs));
} while (true);
