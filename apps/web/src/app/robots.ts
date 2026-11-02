import type { MetadataRoute } from "next";
import { env } from "../env.mjs";
import { SITE_URL } from "../lib/site-url";

// Only mainnet is indexed; the testnet site stays out of search results.
export default function robots(): MetadataRoute.Robots {
  if (env.NETWORK_MODE !== "MAINNET") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
