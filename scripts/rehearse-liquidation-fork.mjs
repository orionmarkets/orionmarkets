import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, rmSync } from "node:fs";

// Rehearses scripts/mainnet-watch.mjs on a local anvil fork of mainnet (no mainnet transaction): a borrower
// opens a real position on the TSLA long pair, the watcher sees it as healthy, the test then pushes the debt
// past the liquidation threshold by writing the pair's storage, and the watcher (with --liquidate, from a
// fresh liquidator wallet) must raise the alert and liquidate.
//   node scripts/rehearse-liquidation-fork.mjs
const require = createRequire(new URL("../apps/keeper/package.json", import.meta.url));
const v = require("viem");
const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");

const PORT = 8547;
const URL_ = `http://127.0.0.1:${PORT}`;
const record = JSON.parse(readFileSync("packages/contracts/deployments/mainnet-4663.json", "utf8"));
const pairAddress = record.addresses["long-tsla"];
const tsla = record.markets.TSLA.token;
const statePath = "/tmp/orion-watch-fork-state.json";
rmSync(statePath, { force: true });

const anvil = spawn("anvil", ["--fork-url", "https://rpc.mainnet.chain.robinhood.com", "--port", String(PORT), "--silent", "--no-rate-limit"], { stdio: "ignore" });
process.on("exit", () => anvil.kill("SIGTERM"));
const chain = { id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [URL_] } } };
const http = v.http(URL_, { timeout: 180000 });
const client = v.createPublicClient({ chain, transport: http });
const rpc = (method, params) => client.request({ method, params });
for (let i = 0; i < 60; i++) {
  try {
    await client.getChainId();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

const pairAbi = v.parseAbi([
  "function depositCollateral(uint256)",
  "function borrow(uint256)",
  "function accounts(address) view returns (uint256 collateral, uint256 debt)",
]);
const checks = [];
const expect = (name, ok, detail = "") => checks.push({ name, ok, detail });

async function as(address, fn) {
  await rpc("anvil_impersonateAccount", [address]);
  await rpc("anvil_setBalance", [address, v.toHex(v.parseEther("1"))]);
  const wallet = v.createWalletClient({ account: address, chain, transport: http });
  const hash = await fn(wallet);
  await client.waitForTransactionReceipt({ hash });
}
// Funds from the project wallet, or (nano launch, fork only) from the public Uniswap v3 pool of the token.
const balanceOf = (token, who) => client.readContract({ address: token, abi: v.erc20Abi, functionName: "balanceOf", args: [who] });
const getPool = v.parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
const V3_FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
async function transfer(token, to, amount) {
  let from = record.owner;
  if ((await balanceOf(token, from)) < amount) {
    const [other, fee] = v.isAddressEqual(token, record.usdg) ? [WETH, 100] : [record.usdg, 3000];
    from = await client.readContract({ address: V3_FACTORY, abi: getPool, functionName: "getPool", args: [token, other, fee] });
  }
  await as(from, (w) => w.writeContract({ address: token, abi: v.erc20Abi, functionName: "transfer", args: [to, amount] }));
}

const borrower = v.getAddress("0x0000000000000000000000000000000000002001");
const liquidatorKey = generatePrivateKey();
const liquidator = privateKeyToAccount(liquidatorKey).address;
// 0.0003 TSLA (about $0.12): a 0.05 USDG borrow stays under the 50% LTV, and the 0.13 USDG debt below is liquidatable.
const stock = 3n * 10n ** 14n;
await transfer(tsla, borrower, stock);
await transfer(record.usdg, liquidator, 200_000n);
await rpc("anvil_setBalance", [liquidator, v.toHex(v.parseEther("1"))]);
await as(borrower, (w) => w.writeContract({ address: tsla, abi: v.erc20Abi, functionName: "approve", args: [pairAddress, stock] }));
await as(borrower, (w) => w.writeContract({ address: pairAddress, abi: pairAbi, functionName: "depositCollateral", args: [stock] }));
await as(borrower, (w) => w.writeContract({ address: pairAddress, abi: pairAbi, functionName: "borrow", args: [50_000n] }));

const watch = (...flags) =>
  spawnSync("node", ["scripts/mainnet-watch.mjs", "--once", ...flags], {
    encoding: "utf8",
    env: { ...process.env, RPC_URL: URL_, WATCH_STATE_PATH: statePath, LIQUIDATOR_PRIVATE_KEY: liquidatorKey, WATCH_MIN_OWNER_ETH: "0" },
    timeout: 600000,
  });

let run = watch();
expect("healthy borrower: exit 0, one open debt", run.status === 0 && /1 open debts, 0 active alerts/.test(run.stdout), run.stdout.trim().split("\n").pop());

// Push the debt past the 65% liquidation threshold (and the pair's total debt with it).
const base = BigInt(v.keccak256(v.encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [borrower, 5n])));
const pad = (n) => v.pad(v.toHex(n), { size: 32 });
await rpc("anvil_setStorageAt", [pairAddress, v.toHex(base + 1n), pad(130_000n)]);
await rpc("anvil_setStorageAt", [pairAddress, pad(10n), pad(130_000n)]);

run = watch();
expect("unhealthy borrower: alert raised, exit 1", run.status === 1 && /LIQUIDATABLE/.test(run.stdout), run.stdout.trim().split("\n")[0]);

const before = await client.readContract({ address: tsla, abi: v.erc20Abi, functionName: "balanceOf", args: [liquidator] });
run = watch("--liquidate");
const after = await client.readContract({ address: tsla, abi: v.erc20Abi, functionName: "balanceOf", args: [liquidator] });
const [, debtLeft] = await client.readContract({ address: pairAddress, abi: pairAbi, functionName: "accounts", args: [borrower] });
expect("liquidation sent and succeeded", /LIQ .*success/.test(run.stdout), run.stdout.split("\n").filter((l) => /LIQ/.test(l)).join(" | "));
expect("liquidator received collateral", after > before, `${v.formatUnits(after - before, 18)} TSLA`);
expect("borrower debt reduced", debtLeft < 130_000n, `${debtLeft} raw USDG left`);

for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks pass`);
process.exit(failed ? 1 : 0);
