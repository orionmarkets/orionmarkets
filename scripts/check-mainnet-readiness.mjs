import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Read-only launch gate for Robinhood Chain mainnet (4663). Checks every condition the app needs before
// Lending, Trade, Earn and Auto-Protect can be used, and exits 1 while any check fails. No transactions.
//   MIN_POOL_USDG   minimum USDG on each swap pool side (default 100)
//   MIN_PAIR_USDG   minimum USDG held by each long pair (default 100)
//   MIN_OWNER_ETH   minimum ETH on the project wallet (default 0.002)
//   RELEASE_VERSION release being opened (default 1, docs/RELEASES.md): AutoProtect is checked from 2, the vault and
//                   the Earn catalog from 3; below that they must stay paused.
const require = createRequire(new URL("../apps/keeper/package.json", import.meta.url));
const v = require("viem");

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const WEB = process.env.ORION_WEB_URL ?? "https://orionmarkets.tech";
// The API listens on 127.0.0.1 of the VPS (docs/HOSTING.md): run this there, or point ORION_API_URL at a tunnel.
const API = process.env.ORION_API_URL ?? "http://127.0.0.1:3201/api/v1";
const record = JSON.parse(readFileSync("packages/contracts/deployments/mainnet-4663.json", "utf8"));
const a = record.addresses;
const minPool = BigInt(Math.round(Number(process.env.MIN_POOL_USDG ?? 100) * 1e6));
const minPair = BigInt(Math.round(Number(process.env.MIN_PAIR_USDG ?? 100) * 1e6));
const minEth = v.parseEther(process.env.MIN_OWNER_ETH ?? "0.002");
const release = Number(process.env.RELEASE_VERSION ?? 1);

const client = v.createPublicClient({ transport: v.http(RPC) });
const abi = v.parseAbi([
  "function isPaused() view returns (bool)",
  "function depositsPaused() view returns (bool)",
  "function getPrice(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function token0() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function markets(bytes32) view returns (bytes32,string,address,address,address,address,uint8,uint8,uint256,uint256,uint256,uint256,uint256)",
]);
const read = (address, functionName, args = []) => client.readContract({ address, abi, functionName, args });
const usd = (raw) => (Number(raw) / 1e6).toFixed(2);

const results = [];
const check = (group, name, ok, detail = "") => results.push({ group, name, ok, detail });
const attempt = async (group, name, fn) => {
  try {
    const [ok, detail] = await fn();
    check(group, name, ok, detail);
  } catch (error) {
    check(group, name, false, String(error.shortMessage ?? error.message).split("\n")[0]);
  }
};

check("chain", "chain id 4663", (await client.getChainId()) === 4663);
await attempt("wallet", "project wallet gas", async () => {
  const balance = await client.getBalance({ address: record.owner });
  return [balance >= minEth, `${v.formatEther(balance)} ETH`];
});

for (const [name, key, fn, from] of [
  ["LeverageRouter", "leverageRouter", "isPaused", 1],
  ["ShortRouter", "shortRouter", "isPaused", 1],
  ["AutoProtect", "autoProtect", "isPaused", 2],
  ["Vault deposits", "vault", "depositsPaused", 3],
]) {
  const open = release >= from;
  await attempt("contracts", `${name} ${open ? "open" : "paused (later release)"}`, async () => {
    const paused = await read(a[key], fn);
    return [paused !== open, paused ? "paused" : "open"];
  });
}

for (const [symbol, market] of Object.entries(record.markets)) {
  const s = symbol.toLowerCase();
  const group = `market ${symbol}`;
  for (const side of ["long", "short"])
    await attempt(group, `${side} market NORMAL`, async () => {
      const row = await read(a.registry, "markets", [market[`${side}MarketId`]]);
      return [row[7] === 0, `status ${row[7]}, borrowCap ${row[12]}, supplyCap ${row[11]}`];
    });
  await attempt(group, "oracle price fresh", async () => {
    const price = await read(a.oracle, "getPrice", [market.token]);
    return [price > 0n, `${Number(price) / 1e18}`];
  });
  await attempt(group, "margin router unpaused", async () => {
    const paused = await read(a[`margin-${s}`], "isPaused");
    return [!paused, paused ? "paused" : "open"];
  });
  await attempt(group, `long pair holds >= ${usd(minPair)} USDG`, async () => {
    const balance = await read(record.usdg, "balanceOf", [a[`long-${s}`]]);
    return [balance >= minPair, `${usd(balance)} USDG`];
  });
  await attempt(group, `swap pool USDG >= ${usd(minPool)}`, async () => {
    const pool = a[`pool-${s}`];
    const [token0, reserves] = await Promise.all([read(pool, "token0"), read(pool, "getReserves")]);
    const raw = v.isAddressEqual(token0, record.usdg) ? reserves[0] : reserves[1];
    return [raw >= minPool, `${usd(raw)} USDG`];
  });
}

const json = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return { status: response.status, body: await response.json().catch(() => null) };
};
await attempt("backend", "API /markets has rows", async () => {
  const { status, body } = await json(`${API}/markets`);
  return [status === 200 && body?.count > 0, `HTTP ${status}, count ${body?.count}`];
});
if (release >= 3) await attempt("backend", "API /vaults has rows", async () => {
  const { status, body } = await json(`${API}/vaults`);
  return [status === 200 && body?.count > 0, `HTTP ${status}, count ${body?.count}`];
});
await attempt("backend", "API /health ok", async () => {
  const { body } = await json(API.replace("/api/v1", "/health"));
  return [body?.status === "ok", `status ${body?.status}, databaseVerified ${body?.databaseVerified}`];
});
await attempt("web", "TSLA market page not disabled", async () => {
  const html = await (await fetch(`${WEB}/market/tsla`, { signal: AbortSignal.timeout(20000) })).text();
  return [!html.includes("Execution disabled"), html.includes("Execution disabled") ? "Execution disabled" : "enabled"];
});

let group = "";
for (const r of results) {
  if (r.group !== group) console.log(`\n${(group = r.group)}`);
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks pass`);
process.exit(failed ? 1 : 0);
