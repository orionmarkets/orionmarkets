import { env } from "../env.mjs";

// Pons surfaces (menu, links, /markets/pons) stay hidden on mainnet until a Pons deployment is configured.
export const PONS_VISIBLE =
  env.NETWORK_MODE !== "MAINNET" || env.PONS_DEPLOYMENT_JSON !== null;
