import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { executeLendingAction } from "../apps/web/src/lib/lending-client.ts";
import { executeMarginAction } from "../apps/web/src/lib/margin-client.ts";

// Rehearses the launch on a local anvil fork of Robinhood Chain mainnet (no mainnet transaction):
// for each market a fresh wallet runs the app's own deposit, borrow, repay, withdraw, then a Long and a Short
// open and close, through the same client code the website uses. Test wallets are funded on the fork from the
// project wallet, or, when it holds too little (nano launch), from the public Uniswap v3 pool of that token
// (impersonated on the fork only). Collateral is half of each market's supply cap.
//   REHEARSE_BORROW_USDG (default 0.03) and REHEARSE_MARGIN_USDG (default 0.03): use 0.01 / 0.005 at nano size.
//   node --import tsx scripts/rehearse-mainnet-fork.mjs [SYMBOL ...]
const require = createRequire(new URL("../apps/keeper/package.json", import.meta.url));
const v = require("viem");

const PORT = 8546;
const RPC = "https://rpc.mainnet.chain.robinhood.com";
const record = JSON.parse(readFileSync("packages/contracts/deployments/mainnet-4663.json", "utf8"));
const launch = JSON.parse(execFileSync("node", ["scripts/generate-mainnet-app-config.mjs", "--launch"], { encoding: "utf8" }));
const rows = JSON.parse(launch.MARKET_DEPLOYMENTS_JSON);
const wanted = process.argv.slice(2);
const BORROW = process.env.REHEARSE_BORROW_USDG ?? "0.03";
const MARGIN = process.env.REHEARSE_MARGIN_USDG ?? "0.03";
// Public Uniswap v3 pools that hold each token (fee tiers as in buy-mainnet-market-tokens.mjs).
const V3_FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const STOCK_FEES = { TSLA: 3000, AMZN: 3000, PLTR: 3000, AMD: 3000, NVDA: 500, SPY: 500, QQQ: 500, SGOV: 500, SLV: 3000, BABA: 3000 };

const anvil = spawn("anvil", ["--fork-url", RPC, "--port", String(PORT), "--silent", "--no-rate-limit"], { stdio: "ignore" });
const stop = () => anvil.kill("SIGTERM");
process.on("exit", stop);
const chain = { id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [`http://127.0.0.1:${PORT}`] } } };
const client = v.createPublicClient({ chain, transport: v.http(undefined, { timeout: 180000 }) });
const rpc = (method, params) => client.request({ method, params });

for (let i = 0; i < 60; i++) {
  try {
    await client.getChainId();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

// Stock tokens do not use a plain balance slot, so the test wallets are funded by transfers from the project wallet
// (impersonated on the fork only), or from a public pool (see fund).
await rpc("anvil_impersonateAccount", [record.owner]);
await rpc("anvil_setBalance", [record.owner, v.toHex(v.parseEther("1"))]);
const balanceOf = (token, who) => client.readContract({ address: token, abi: v.erc20Abi, functionName: "balanceOf", args: [who] });
const getPool = v.parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
async function fund(token, who, amount, symbol) {
  let from = record.owner;
  if ((await balanceOf(token, from)) < amount) {
    const [other, fee] = v.isAddressEqual(token, record.usdg) ? [WETH, 100] : [record.usdg, STOCK_FEES[symbol]];
    from = await client.readContract({ address: V3_FACTORY, abi: getPool, functionName: "getPool", args: [token, other, fee] });
    await rpc("anvil_impersonateAccount", [from]);
    await rpc("anvil_setBalance", [from, v.toHex(v.parseEther("1"))]);
  }
  const sender = v.createWalletClient({ account: from, chain, transport: v.http(undefined, { timeout: 180000 }) });
  const hash = await sender.writeContract({ address: token, abi: v.erc20Abi, functionName: "transfer", args: [who, amount] });
  await client.waitForTransactionReceipt({ hash });
}
const registryAbi = v.parseAbi(["function getMarket(bytes32) view returns ((bytes32 marketId,string slug,address collateralToken,address debtToken,address pairAddress,address oracle,uint8 riskTier,uint8 status,uint256 maxLtvBps,uint256 liquidationLtvBps,uint256 maxLeverageBps,uint256 supplyCap,uint256 borrowCap))"]);

const results = [];
let failed = 0;
const step = async (symbol, name, fn) => {
  try {
    await fn();
    results.push(`PASS  ${symbol}  ${name}`);
  } catch (error) {
    failed++;
    results.push(`FAIL  ${symbol}  ${name}  (${error.code ?? error.message})`);
  }
};

let n = 0x1000;
for (const row of rows.filter((r) => !wanted.length || wanted.includes(r.symbol))) {
  const { symbol, long, margin } = row;
  const account = v.getAddress(`0x${(++n).toString(16).padStart(40, "0")}`);
  await rpc("anvil_setBalance", [account, v.toHex(v.parseEther("1"))]);
  await rpc("anvil_impersonateAccount", [account]);
  const wallet = v.createWalletClient({ account, chain, transport: v.http(undefined, { timeout: 180000 }) });
  wallet.getAddresses = async () => [account]; // anvil's eth_accounts does not list impersonated accounts
  const { supplyCap } = await client.readContract({ address: record.addresses.registry, abi: registryAbi, functionName: "getMarket", args: [record.markets[symbol].longMarketId] });
  const stock = supplyCap / 2n;
  const stockInput = v.formatUnits(stock, long.collateralDecimals);
  await fund(long.collateral, account, stock, symbol);
  await fund(long.debt, account, 200_000n, symbol); // 0.2 USDG
  const common = { client, wallet, account, confirmations: 1, timeoutMs: 30000, onStage: () => {} };
  const lend = (action, input) =>
    executeLendingAction({ ...common, deployment: long, enabled: true, action, input });
  const marginAction = (isShort, action, input, multipleBps) =>
    executeMarginAction({ ...common, deployment: margin, long, enabled: true, isShort, action, input, multipleBps });

  await step(symbol, `lending deposit ${stockInput}`, () => lend("deposit", stockInput));
  await step(symbol, `lending borrow ${BORROW} USDG`, () => lend("borrow", BORROW));
  await step(symbol, `lending repay ${BORROW} USDG`, () => lend("repay", BORROW));
  await step(symbol, `lending withdraw ${stockInput}`, () => lend("withdraw", stockInput));
  for (const bps of margin.policy.longLeveragesBps) {
    await step(symbol, `long ${bps / 10000}x open (${MARGIN} USDG)`, () => marginAction(false, "open", MARGIN, bps));
    await step(symbol, `long ${bps / 10000}x close`, () => marginAction(false, "close", "0", 0));
  }
  for (const bps of margin.policy.shortExposureBps) {
    await step(symbol, `short ${bps / 10000}x open (${MARGIN} USDG)`, () => marginAction(true, "open", MARGIN, bps));
    await step(symbol, `short ${bps / 10000}x close`, () => marginAction(true, "close", "0", 0));
  }
  await rpc("anvil_stopImpersonatingAccount", [account]);
}

console.log(results.join("\n"));
console.log(`\n${results.length - failed}/${results.length} steps pass on a fork of block ${await client.getBlockNumber()}`);
stop();
process.exit(failed ? 1 : 0);
