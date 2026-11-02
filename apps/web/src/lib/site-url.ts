import { env } from "../env.mjs";

// Public host of each deployment. The header switch links between them.
export const MAINNET_ORIGIN = "https://www.orionmarkets.live";
export const TESTNET_ORIGIN = "https://testnet.orionmarkets.live";

// Canonical origin for robots.txt and sitemap.xml: the configured site URL, else the network's public host.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (env.NETWORK_MODE === "MAINNET" ? MAINNET_ORIGIN : TESTNET_ORIGIN)
).replace(/\/$/, "");
