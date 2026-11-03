import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";

// Opens 2x, 5x and 10x on every ORION mainnet market, the same parameters as the testnet 10x update (docs/TESTNET.md):
//   per pair (long and short): setLiquidationBonus(1%), then registry updateRiskTier: max LTV 94%, liquidation LTV 97%,
//   max leverage 10x (tier unchanged). The bonus goes first: 1% fits both the launch and the new liquidation LTV.
// The website follows: generate-mainnet-app-config.mjs offers 2x/5x/10x on a market once both its pairs are at 94%.
// Every step checks the chain first and is skipped when already applied, so a re-run resumes.
//   --plan    applies everything on a local fork (owner impersonated, no key), then runs rehearse-mainnet-fork.mjs on that
//             fork: deposit, borrow, repay, withdraw and every 2x/5x/10x long and short open and close per market
//   --run     broadcasts the remaining steps (needs MAINNET_LEVERAGE_BROADCAST_ENABLED=true in the profile)
//   --verify  read-only check of the mainnet parameters
// Nano liquidity: the largest margin at 10x is about 0.0001 USDG (REHEARSE_MARGIN_USDG for the plan).
const require = createRequire(new URL("../apps/keeper/package.json", import.meta.url));
const v = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const profile = ".env.mainnet.core.local";
const record = JSON.parse(readFileSync("packages/contracts/deployments/mainnet-4663.json", "utf8"));
const MAX_LTV = 9400n;
const LIQ_LTV = 9700n;
const MAX_LEVERAGE = 100000n;
const BONUS = 100n;

const check = (ok, code) => {
  if (!ok) throw Error(code);
};
const registryAbi = v.parseAbi([
  "function getMarket(bytes32) view returns ((bytes32 marketId,string slug,address collateralToken,address debtToken,address pairAddress,address oracle,uint8 riskTier,uint8 status,uint256 maxLtvBps,uint256 liquidationLtvBps,uint256 maxLeverageBps,uint256 supplyCap,uint256 borrowCap))",
  "function updateRiskTier(bytes32,uint8,uint256,uint256,uint256)",
]);
const pairAbi = v.parseAbi(["function liquidationBonusBps() view returns (uint256)", "function setLiquidationBonus(uint256)"]);

// Ordered steps: { id, done(client), data(client) }.
function steps() {
  const out = [];
  const market = (client, id) => client.readContract({ address: record.addresses.registry, abi: registryAbi, functionName: "getMarket", args: [id] });
  for (const [symbol, m] of Object.entries(record.markets))
    for (const side of ["long", "short"]) {
      const pair = record.addresses[`${side}-${symbol.toLowerCase()}`];
      out.push({
        id: `bonus-${side}-${symbol}`,
        to: pair,
        done: async (c) => (await c.readContract({ address: pair, abi: pairAbi, functionName: "liquidationBonusBps" })) === BONUS,
        data: async () => v.encodeFunctionData({ abi: pairAbi, functionName: "setLiquidationBonus", args: [BONUS] }),
      });
    }
  for (const [symbol, m] of Object.entries(record.markets))
    for (const side of ["long", "short"]) {
      const id = m[`${side}MarketId`];
      out.push({
        id: `risk-${side}-${symbol}`,
        to: record.addresses.registry,
        done: async (c) => {
          const x = await market(c, id);
          return x.maxLtvBps === MAX_LTV && x.liquidationLtvBps === LIQ_LTV && x.maxLeverageBps === MAX_LEVERAGE;
        },
        data: async (c) =>
          v.encodeFunctionData({ abi: registryAbi, functionName: "updateRiskTier", args: [id, (await market(c, id)).riskTier, MAX_LTV, LIQ_LTV, MAX_LEVERAGE] }),
      });
    }
  return out;
}

async function apply(client, wallet, from, feeCap, confirmations) {
  let gasUsed = 0n;
  let sent = 0;
  for (const s of steps()) {
    if (await s.done(client)) continue;
    const data = await s.data(client);
    const [latest, pending] = await Promise.all(["latest", "pending"].map((blockTag) => client.getTransactionCount({ address: from, blockTag })));
    check(latest === pending, "SIGNER_HAS_PENDING_TRANSACTION");
    const gas = ((await client.estimateGas({ account: from, to: s.to, data })) * 13n) / 10n;
    const fees = await client.estimateFeesPerGas({ type: "eip1559" });
    if (feeCap) check(fees.maxFeePerGas <= feeCap, "FEE_PER_GAS_LIMIT_EXCEEDED");
    const hash = await wallet.sendTransaction({ to: s.to, data, gas, nonce: latest, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations, timeout: 180000 });
    check(receipt.status === "success", `REVERTED_${s.id}`);
    gasUsed += receipt.gasUsed;
    sent++;
    console.log(JSON.stringify({ stage: "confirmed", id: s.id, hash }));
  }
  return { gasUsed, sent };
}
async function verify(client) {
  const pending = [];
  for (const s of steps()) if (!(await s.done(client))) pending.push(s.id);
  return pending;
}

const chainFor = (url) => v.defineChain({ id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
async function freePort() {
  return new Promise((ok, fail) => {
    const server = createServer();
    server.unref();
    server.on("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => ok(port));
    });
  });
}

let anvil;
try {
  const mode = process.argv[2];
  check(process.argv.length === 3 && ["--plan", "--run", "--verify"].includes(mode), "EXPLICIT_MODE_REQUIRED");
  const main = v.createPublicClient({ chain: chainFor(RPC), transport: v.http(RPC, { timeout: 60000 }), cacheTime: 0 });
  check((await main.getChainId()) === 4663, "RPC_CHAIN_MISMATCH");

  if (mode === "--plan") {
    const port = await freePort();
    const url = `http://127.0.0.1:${port}`;
    anvil = spawn("anvil", ["--fork-url", RPC, "--port", String(port), "--silent", "--no-rate-limit"], { stdio: "ignore" });
    const client = v.createPublicClient({ chain: chainFor(url), transport: v.http(url, { timeout: 180000 }), cacheTime: 0 });
    for (let i = 0; i < 120; i++) {
      try {
        await client.getChainId();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    await client.request({ method: "anvil_impersonateAccount", params: [record.owner] });
    await client.request({ method: "anvil_setBalance", params: [record.owner, v.toHex(v.parseEther("1"))] });
    const wallet = v.createWalletClient({ account: record.owner, chain: chainFor(url), transport: v.http(url, { timeout: 180000 }) });
    const { gasUsed, sent } = await apply(client, wallet, record.owner, 0n, 1);
    const left = await verify(client);
    check(left.length === 0, `FORK_NOT_APPLIED_${left.join("_")}`);
    console.log(JSON.stringify({ stage: "fork-applied", transactions: sent, gasUsed: String(gasUsed) }));
    const rehearsal = spawnSync("node", ["--import", "tsx", "scripts/rehearse-mainnet-fork.mjs"], {
      encoding: "utf8",
      env: { ...process.env, REHEARSE_FORK_URL: url, REHEARSE_BORROW_USDG: process.env.REHEARSE_BORROW_USDG ?? "0.01", REHEARSE_MARGIN_USDG: process.env.REHEARSE_MARGIN_USDG ?? "0.0001" },
      timeout: 900000,
    });
    console.log(rehearsal.stdout.trim());
    check(rehearsal.status === 0, "FORK_REHEARSAL_FAILED");
    const gasPrice = await main.getGasPrice();
    console.log(JSON.stringify({ rehearsal: "PASSED", transactions: sent, estimatedFeeEth: v.formatEther((gasUsed * gasPrice * 15n) / 10n) }));
  } else if (mode === "--run") {
    const env = parseEnv(readFileSync(profile, "utf8"));
    check(env.NETWORK_MODE === "MAINNET" && env.CHAIN_ID === "4663", "ROBINHOOD_MAINNET_REQUIRED");
    check(env.MAINNET_LEVERAGE_BROADCAST_ENABLED === "true", "MAINNET_BROADCAST_NOT_AUTHORIZED");
    const account = privateKeyToAccount(env.PRIVATE_KEY);
    check(v.isAddressEqual(account.address, record.owner), "SIGNER_IS_NOT_PROTOCOL_OWNER");
    const wallet = v.createWalletClient({ account, chain: chainFor(env.RPC_URL), transport: v.http(env.RPC_URL, { timeout: 60000 }) });
    const { sent } = await apply(main, wallet, account.address, BigInt(env.MAINNET_MAX_FEE_PER_GAS_WEI), 2);
    console.log(JSON.stringify({ stage: "run-complete", transactions: sent, next: "node scripts/raise-mainnet-leverage.mjs --verify" }));
  } else {
    const left = await verify(main);
    console.log(JSON.stringify({ stage: "verify", pending: left }));
    check(left.length === 0, "LEVERAGE_NOT_APPLIED");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  console.error(JSON.stringify({ error: /^[A-Z][A-Z0-9_]+$/.test(message) ? message : (error?.shortMessage ?? "RAISE_LEVERAGE_FAILED_DETAILS_REDACTED") }));
  process.exitCode = 1;
} finally {
  anvil?.kill("SIGTERM");
}
