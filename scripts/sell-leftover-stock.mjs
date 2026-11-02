import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";

// Sells the stock tokens left over in the deployer wallet from the 5% buying buffer (TSLA, AMZN, PLTR, AMD by
// default) for USDG through the same Uniswap v3 pools the buying script uses. The USDG pays for the next market
// opening instead of buying USDG with ETH. Only a token whose quote is worth at least MIN_USDG is sold, so the gas
// of a swap never exceeds what it returns. Each swap is exact-input with at most 1% slippage under a fresh quote.
//
//   --plan  quotes on mainnet (read-only, no transaction)
//   --run   broadcasts the swaps to mainnet (needs MAINNET_SWAP_BROADCAST_ENABLED=true)
//
// MAINNET_SELL_MARKETS selects the tokens (default "TSLA,AMZN,PLTR,AMD").
const require = createRequire(new URL("../apps/keeper/package.json", import.meta.url));
const v = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const CHAIN_ID = 4663;
const profile = ".env.mainnet.core.local";
const ROUTER = "0xcaf681a66d020601342297493863e78c959e5cb2";
const QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
// Fee tier of the deepest Uniswap v3 stock/USDG pool per market (same table as buy-mainnet-market-tokens.mjs).
const STOCK_FEES = { TSLA: 3000, AMZN: 3000, PLTR: 3000, AMD: 3000, NVDA: 500, SPY: 500, QQQ: 500, SGOV: 500, SLV: 3000 };
const MIN_USDG = 100000n; // 0.10 USDG
const SLIPPAGE_BPS = 100n;

const check = (ok, code) => {
  if (!ok) throw Error(code);
};
const mode = process.argv[2];
check(process.argv.length === 3 && ["--plan", "--run"].includes(mode), "EXPLICIT_MODE_REQUIRED");
const markets = JSON.parse(readFileSync("scripts/mainnet-full-deploy.config.json", "utf8")).markets;
const selected = (process.env.MAINNET_SELL_MARKETS ?? "TSLA,AMZN,PLTR,AMD").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
const STOCKS = selected.map((symbol) => {
  const m = markets.find((x) => x.symbol === symbol);
  check(m && STOCK_FEES[symbol], "UNKNOWN_MARKET_IN_MAINNET_SELL_MARKETS");
  return { symbol, token: m.token, fee: STOCK_FEES[symbol] };
});

const quoterAbi = v.parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);
const routerAbi = v.parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

function loadProfile() {
  execFileSync("git", ["check-ignore", "-q", profile], { stdio: "pipe" });
  check((statSync(profile).mode & 0o077) === 0, "PROFILE_REQUIRES_MODE_0600");
  const env = parseEnv(readFileSync(profile, "utf8"));
  check(env.CHAIN_ID === String(CHAIN_ID), "ROBINHOOD_MAINNET_REQUIRED");
  const account = privateKeyToAccount(env.PRIVATE_KEY);
  check(account.address.toLowerCase() === env.DEPLOYER_ADDRESS.toLowerCase(), "SIGNER_IDENTITY_MISMATCH");
  return { env, account };
}

try {
  const { env, account } = loadProfile();
  check(new URL(env.RPC_URL).protocol === "https:", "HTTPS_RPC_REQUIRED");
  const chain = v.defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env.RPC_URL] } },
  });
  const transport = v.http(env.RPC_URL, { timeout: 60000, retryCount: 1 });
  const client = v.createPublicClient({ chain, transport, cacheTime: 0 });
  const wallet = v.createWalletClient({ account, chain, transport });
  check((await client.getChainId()) === CHAIN_ID, "RPC_CHAIN_MISMATCH");
  const owner = account.address;
  const balanceOf = (token) => client.readContract({ address: token, abi: v.erc20Abi, functionName: "balanceOf", args: [owner] });

  const sells = [];
  for (const s of STOCKS) {
    const amountIn = await balanceOf(s.token);
    if (amountIn === 0n) {
      console.log(JSON.stringify({ symbol: s.symbol, skipped: "no balance" }));
      continue;
    }
    const quote = (await client.simulateContract({
      address: QUOTER,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: s.token, tokenOut: USDG, amountIn, fee: s.fee, sqrtPriceLimitX96: 0n }],
    })).result[0];
    const minOut = (quote * (10000n - SLIPPAGE_BPS)) / 10000n;
    const row = { symbol: s.symbol, amountIn: v.formatUnits(amountIn, 18), quoteUsdg: v.formatUnits(quote, 6) };
    if (quote < MIN_USDG) {
      console.log(JSON.stringify({ ...row, skipped: "worth less than 0.10 USDG" }));
      continue;
    }
    console.log(JSON.stringify(row));
    sells.push({ ...s, amountIn, minOut });
  }
  const total = sells.reduce((a, s) => a + s.minOut, 0n);
  console.log(JSON.stringify({ swaps: sells.length, minUsdgReceived: v.formatUnits(total, 6), ethBalance: v.formatEther(await client.getBalance({ address: owner })) }));

  if (mode === "--run") {
    check(env.MAINNET_SWAP_BROADCAST_ENABLED === "true", "MAINNET_BROADCAST_NOT_AUTHORIZED");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    for (const s of sells) {
      const allowance = await client.readContract({ address: s.token, abi: v.erc20Abi, functionName: "allowance", args: [owner, ROUTER] });
      if (allowance < s.amountIn) {
        const hash = await wallet.writeContract({ address: s.token, abi: v.erc20Abi, functionName: "approve", args: [ROUTER, s.amountIn] });
        check((await client.waitForTransactionReceipt({ hash })).status === "success", `APPROVE_${s.symbol}_FAILED`);
      }
      const call = v.encodeFunctionData({
        abi: routerAbi,
        functionName: "exactInputSingle",
        args: [{ tokenIn: s.token, tokenOut: USDG, fee: s.fee, recipient: owner, amountIn: s.amountIn, amountOutMinimum: s.minOut, sqrtPriceLimitX96: 0n }],
      });
      const hash = await wallet.writeContract({ address: ROUTER, abi: routerAbi, functionName: "multicall", args: [deadline, [call]] });
      check((await client.waitForTransactionReceipt({ hash })).status === "success", `SWAP_${s.symbol}_TO_USDG_FAILED`);
      console.log(JSON.stringify({ step: `${s.symbol}->USDG`, amount: v.formatUnits(s.amountIn, 18), hash }));
    }
    console.log(JSON.stringify({ usdg: v.formatUnits(await balanceOf(USDG), 6), eth: v.formatEther(await client.getBalance({ address: owner })) }));
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  console.error(JSON.stringify({ error: /^[A-Z][A-Z0-9_]+$/.test(message) ? message : (error?.shortMessage ?? "SELL_LEFTOVER_FAILED_DETAILS_REDACTED") }));
  process.exitCode = 1;
}
