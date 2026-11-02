import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Builds the mainnet application deployment variables (PROTOCOL_ADDRESSES and
// MARKET_DEPLOYMENTS_JSON) from the verified deployment record and on-chain code hashes,
// then validates them with the web environment schema. Prints JSON; no transactions.
// With --launch it also emits the enablement variables (every market enabled, lending and margin on,
// the first market as the accepted single deployment); apply those only after the on-chain gates pass
// (node scripts/check-mainnet-readiness.mjs).
const require = createRequire(
  new URL("../apps/keeper/package.json", import.meta.url),
);
const v = require("viem");
const webRequire = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { clientSchema, validate } = webRequire("./config/environment.cjs");

const CHAIN_ID = 4663;
const launch = process.argv.includes("--launch");
const record = JSON.parse(
  readFileSync("packages/contracts/deployments/mainnet-4663.json", "utf8"),
);
const config = JSON.parse(
  readFileSync("scripts/mainnet-full-deploy.config.json", "utf8"),
);
const client = v.createPublicClient({
  transport: v.http("https://rpc.mainnet.chain.robinhood.com"),
});
const codeHash = async (address) => {
  const code = await client.getCode({ address });
  if (!code || code === "0x") throw Error(`NO_CODE_${address}`);
  return v.keccak256(code);
};
if ((await client.getChainId()) !== CHAIN_ID) throw Error("WRONG_CHAIN");

const a = record.addresses;
const usdg = v.getAddress(config.oracle.stable.token);
const [registryHash, oracleHash, usdgHash, factoryHash] = await Promise.all([
  codeHash(a.registry),
  codeHash(a.oracle),
  codeHash(usdg),
  codeHash(a.v2Factory),
]);
// Same execution limits as the accepted testnet margin plan, within each market's caps.
const policy = {
  maxMarginRaw: "10000000",
  slippageBps: 50,
  deadlineSeconds: 120,
  gasBufferBps: 13000,
  maxGasLimit: "1500000",
  longLeveragesBps: [12500, 15000],
  // The mainnet short markets cap LTV at 40% (maxLtvBps 4000). A short of exposure e (debt value over margin) opens at
  // about e / (1 + e) LTV, so 100% and 125% exposure (testnet values, 60% cap there) revert with "Max LTV limit".
  shortExposureBps: [5000, 6000],
};

const tokens = { USDG: usdg };
const pairs = {};
const rows = [];
// Only markets present in the deployment record (a market added after launch has no pair or router yet).
// A market with webEnabled false stays off the website until it is opened on chain (remove the flag then).
for (const m of config.markets.filter((x) => record.markets?.[x.symbol] && x.webEnabled !== false)) {
  const s = m.symbol.toLowerCase();
  const token = v.getAddress(m.token);
  tokens[m.symbol] = token;
  pairs[m.symbol] = v.getAddress(a[`long-${s}`]);
  const [tokenHash, longHash, shortHash, routerHash, poolHash] =
    await Promise.all([
      codeHash(token),
      codeHash(a[`long-${s}`]),
      codeHash(a[`short-${s}`]),
      codeHash(a[`margin-${s}`]),
      codeHash(a[`pool-${s}`]),
    ]);
  const market = record.markets[m.symbol];
  const long = {
    chainId: CHAIN_ID,
    marketId: market.longMarketId,
    pair: v.getAddress(a[`long-${s}`]),
    registry: v.getAddress(a.registry),
    oracle: v.getAddress(a.oracle),
    collateral: token,
    debt: usdg,
    collateralSymbol: m.symbol,
    debtSymbol: "USDG",
    collateralDecimals: m.decimals,
    debtDecimals: config.oracle.stable.decimals,
    codeHashes: {
      pair: longHash,
      registry: registryHash,
      oracle: oracleHash,
      collateral: tokenHash,
      debt: usdgHash,
    },
  };
  const short = {
    chainId: CHAIN_ID,
    marketId: market.shortMarketId,
    pair: v.getAddress(a[`short-${s}`]),
    registry: v.getAddress(a.registry),
    oracle: v.getAddress(a.oracle),
    collateral: usdg,
    debt: token,
    collateralSymbol: "USDG",
    debtSymbol: m.symbol,
    collateralDecimals: config.oracle.stable.decimals,
    debtDecimals: m.decimals,
    codeHashes: {
      pair: shortHash,
      registry: registryHash,
      oracle: oracleHash,
      collateral: usdgHash,
      debt: tokenHash,
    },
  };
  rows.push({
    symbol: m.symbol,
    enabled: launch,
    long,
    margin: {
      chainId: CHAIN_ID,
      owner: v.getAddress(record.owner),
      router: v.getAddress(a[`margin-${s}`]),
      factory: v.getAddress(a.v2Factory),
      pool: v.getAddress(a[`pool-${s}`]),
      longPair: long.pair,
      short,
      codeHashes: { router: routerHash, factory: factoryHash, pool: poolHash },
      policy,
    },
  });
}

const values = {
  USDG_ADDRESS: usdg,
  PROTOCOL_ADDRESSES: JSON.stringify({
    usdg,
    oracle: v.getAddress(a.oracle),
    registry: v.getAddress(a.registry),
    orionRouter: v.getAddress(a.lendingRouter),
    leverageRouter: v.getAddress(a.leverageRouter),
    shortRouter: v.getAddress(a.shortRouter),
    autoProtect: v.getAddress(a.autoProtect),
    orionVault: v.getAddress(a.vault),
    tokens,
    pairs,
  }),
  MARKET_DEPLOYMENTS_JSON: JSON.stringify(rows),
};
if (launch) {
  if (!rows.length) throw Error("NO_MARKETS");
  Object.assign(values, {
    TRADING_ENABLED: "false",
    LENDING_ENABLED: "true",
    MARGIN_TRADING_ENABLED: "true",
    LENDING_DEPLOYMENT_JSON: JSON.stringify(rows[0].long),
    MARGIN_DEPLOYMENT_JSON: JSON.stringify(rows[0].margin),
  });
}
validate(clientSchema, {
  NETWORK_MODE: "MAINNET",
  CHAIN_ID: String(CHAIN_ID),
  CHAIN_NAME: "Robinhood Chain",
  EXPLORER_URL: "https://robinhoodchain.blockscout.com",
  NATIVE_CURRENCY_NAME: "Ether",
  NATIVE_CURRENCY_SYMBOL: "ETH",
  NATIVE_CURRENCY_DECIMALS: "18",
  TRADING_ENABLED: "false",
  MARGIN_TRADING_ENABLED: "false",
  MARGIN_DEPLOYMENT_JSON: "",
  LENDING_ENABLED: "false",
  LENDING_DEPLOYMENT_JSON: "",
  LENDING_RECEIPT_CONFIRMATIONS: "2",
  LENDING_RECEIPT_TIMEOUT_MS: "120000",
  USDG_FAUCET_URL: "",
  UI_POLL_INTERVAL_MS: "15000",
  ...values,
});
console.log(JSON.stringify(values));
