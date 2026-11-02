import type { NetworkMode } from "@orion/types";
import { MAINNET_ORIGIN, TESTNET_ORIGIN } from "./site-url";

// Pages one network hides (see earn-visible.ts, pons-visible.ts and china-visible.ts): switching there would land on a 404.
// China Equities needs a deployed China market, which exists on mainnet only (Robinhood has no testnet BABA token).
const HIDDEN: Record<NetworkMode, string[]> = { MAINNET: ["/earn", "/markets/pons"], TESTNET: ["/markets/china"] };

/** The same page on the other network's deployment, or /markets when the other network does not have it. */
export function networkSwitchHref(target: NetworkMode, pathname: string): string {
  const origin = target === "MAINNET" ? MAINNET_ORIGIN : TESTNET_ORIGIN;
  const hidden = HIDDEN[target].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return `${origin}${hidden ? "/markets" : pathname}`;
}
