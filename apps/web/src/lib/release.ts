import { env } from "../env.mjs";
// Release plan (docs/RELEASES.md) applies to mainnet only; testnet and localnet show every feature.
export const RELEASE: number = env.NETWORK_MODE === "MAINNET" ? env.RELEASE_VERSION : 3;
export const releaseAtLeast = (version: number) => RELEASE >= version;
const MARKET_RELEASE: Record<string, number> = { SPY: 2, QQQ: 2, SGOV: 2, SLV: 2, BABA: 2 };
/** A market is listed from its release on; markets not named above are v1.0. */
export const marketVisible = (symbol: string) => releaseAtLeast(MARKET_RELEASE[symbol.toUpperCase()] ?? 1);
export const AUTOPROTECT_VISIBLE = releaseAtLeast(2);
/** "TSLA, AMZN and PLTR": the markets live on this network, for marketing copy. */
export function liveMarketList(symbols: string[]) {
  const list = symbols.filter(marketVisible);
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list.join("");
}
