import { z } from "zod";
import { marketVisible } from "./release";
import catalog from "../../../../data/asset-catalog.json";
export const assetCatalog = z
  .array(
    z.object({
      ticker: z.string().regex(/^[A-Z0-9]+$/),
      name: z.string().min(1),
      image: z.string().startsWith("/assets/"),
      className: z.string(),
      indexStr: z.string(),
      featured: z.boolean(),
      category: z.enum(["ETFs", "China"]).optional(),
      mainnetOnly: z.boolean().optional(),
    }),
  )
  .parse(catalog)
  .filter((asset) => marketVisible(asset.ticker));
export function marketPath(symbol: string) {
  return `/markets/${encodeURIComponent(symbol.toLowerCase())}`;
}
export function tradePath(symbol: string) {
  return `/trade?asset=${encodeURIComponent(symbol)}`;
}
