import { z } from "zod";
import catalogJson from "../../../../data/chinese-equities-catalog.json";

export const ChineseEquityAssetSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  symbol: z.string(),
  assetId: z.string(),
  company: z.string(),
  country: z.string(),
  isin: z.string(),
  cusip: z.string().optional(),
  productIsin: z.string().optional(),
  instrumentType: z.string(),
  depositaryStructure: z.string().optional(),
  depositaryRatio: z.string().optional(),
  underlyingExchange: z.string(),
  underlyingCurrency: z.string(),
  tokenIssuer: z.string().nullable().optional(),
  tokenAddress: z.string().nullable().optional(),
  targetChainId: z.number().nullable().optional(),
  decimals: z.number().nullable().optional(),
  image: z.string(),
  track: z.enum(["US_LISTED_ADR", "HONG_KONG_CANDIDATE", "MAINLAND_A_SHARE"]),
  verificationStatus: z.enum([
    "VERIFIED_NATIVE_IDENTITY",
    "VERIFIED_EXTERNAL_PRODUCT",
    "RESEARCH_ONLY",
    "VERIFIED_PILOT",
    "PENDING_REVIEW",
    "RESEARCH_QUEUE",
  ]),
  isPilotAsset: z.boolean(),
  featured: z.boolean().default(false),
  description: z.string(),
});

export type ChineseEquityAsset = z.infer<typeof ChineseEquityAssetSchema>;

export const chineseEquitiesCatalog: ChineseEquityAsset[] = z
  .array(ChineseEquityAssetSchema)
  .parse(catalogJson);

export function getChineseAssetBySymbol(symbol: string): ChineseEquityAsset | undefined {
  return chineseEquitiesCatalog.find((a) => a.ticker.toUpperCase() === symbol.toUpperCase());
}
