import { marketDeployments } from "./market-deployments";

// China Equities is the set of deployed markets whose ticker is in the China group of the asset catalog
// (data/asset-catalog.json). The page stays hidden on a network until one of them is deployed and enabled.
import catalog from "../../../../data/asset-catalog.json";

export const CHINA_TICKERS: string[] = catalog.filter((a) => (a as { category?: string }).category === "China").map((a) => a.ticker);
export const CHINA_VISIBLE = marketDeployments.some((x) => x.enabled && CHINA_TICKERS.includes(x.symbol));
