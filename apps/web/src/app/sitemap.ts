import type { MetadataRoute } from "next";
import { assetCatalog, marketPath } from "../lib/asset-catalog";
import { CHINA_VISIBLE } from "../lib/china-visible";
import { EARN_VISIBLE } from "../lib/earn-visible";
import { PONS_VISIBLE } from "../lib/pons-visible";
import { SITE_URL } from "../lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/markets",
    "/lending",
    "/trade",
    "/portfolio",
    "/analytics",
    "/faq",
    "/docs",
    "/contracts",
    ...(EARN_VISIBLE ? ["/earn"] : []),
    ...(PONS_VISIBLE ? ["/markets/pons"] : []),
    ...(CHINA_VISIBLE ? ["/markets/china"] : []),
    ...assetCatalog.map((asset) => marketPath(asset.ticker)),
  ];
  return [...new Set(paths)].map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` }));
}
