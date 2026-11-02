import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { executeLendingAction } from "../apps/web/src/lib/lending-client.ts";
import { executeMarginAction } from "../apps/web/src/lib/margin-client.ts";

// Rehearses the launch on a local anvil fork of Robinhood Chain mainnet (no mainnet transaction):
// for each market a fresh wallet runs the app's own deposit, borrow, repay, withdraw, then a Long and a Short
// open and close, through the same client code the website uses. Stock tokens and USDG are minted on the fork
// by writing the token balance slot. Amounts stay inside the launch caps.
//   node --import tsx scripts/rehearse-mainnet-fork.mjs [SYMBOL ...]
const require = createRequire(new URL("../apps/keeper/package.json", import.meta.url));
const v = require("viem");

const PORT = 8546;
const RPC = "https://rpc.mainnet.chain.robinhood.com";
const record = JSON.parse(readFileSync("packages/contracts/deployments/mainnet-4663.json", "utf8"));
const launch = JSON.parse(execFileSync("node", ["scripts/generate-mainnet-app-config.mjs", "--launch"], { encoding: "utf8" }));
const rows = JSON.parse(launch.MARKET_DEPLOYMENTS_JSON);
const wanted = process.argv.slice(2);

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
// (impersonated on the fork only).
await rpc("anvil_impersonateAccount", [record.owner]);
await rpc("anvil_setBalance", [record.owner, v.toHex(v.parseEther("1"))]);
const ownerWallet = v.createWalletClient({ account: record.owner, chain, transport: v.http(undefined, { timeout: 180000 }) });
async function fund(token, who, amount) {
  const hash = await ownerWallet.writeContract({ address: token, abi: v.erc20Abi, functionName: "transfer", args: [who, amount] });
  await client.waitForTransactionReceipt({ hash });
}
const balanceOf = (token, who) => client.readContract({ address: token, abi: v.erc20Abi, functionName: "balanceOf", args: [who] });

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
  const stock = ((await balanceOf(long.collateral, record.owner)) * 6n) / 10n;
  const stockInput = v.formatUnits(stock, long.collateralDecimals);
  await fund(long.collateral, account, stock);
  await fund(long.debt, account, 200_000n); // 0.2 USDG
  const common = { client, wallet, account, confirmations: 1, timeoutMs: 30000, onStage: () => {} };
  const lend = (action, input) =>
    executeLendingAction({ ...common, deployment: long, enabled: true, action, input });
  const marginAction = (isShort, action, input, multipleBps) =>
    executeMarginAction({ ...common, deployment: margin, long, enabled: true, isShort, action, input, multipleBps });

  await step(symbol, `lending deposit ${stockInput}`, () => lend("deposit", stockInput));
  await step(symbol, "lending borrow 0.03 USDG", () => lend("borrow", "0.03"));
  await step(symbol, "lending repay 0.03 USDG", () => lend("repay", "0.03"));
  await step(symbol, `lending withdraw ${stockInput}`, () => lend("withdraw", stockInput));
  for (const bps of margin.policy.longLeveragesBps) {
    await step(symbol, `long ${bps / 10000}x open (0.03 USDG)`, () => marginAction(false, "open", "0.03", bps));
    await step(symbol, `long ${bps / 10000}x close`, () => marginAction(false, "close", "0", 0));
  }
  for (const bps of margin.policy.shortExposureBps) {
    await step(symbol, `short ${bps / 10000}x open (0.03 USDG)`, () => marginAction(true, "open", "0.03", bps));
    await step(symbol, `short ${bps / 10000}x close`, () => marginAction(true, "close", "0", 0));
  }
  await rpc("anvil_stopImpersonatingAccount", [account]);
}

console.log(results.join("\n"));
console.log(`\n${results.length - failed}/${results.length} steps pass on a fork of block ${await client.getBlockNumber()}`);
stop();
process.exit(failed ? 1 : 0);
