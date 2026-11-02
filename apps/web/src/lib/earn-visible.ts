import { env } from "../env.mjs";

// OrionVault is a custody foundation: it holds deposits but allocates to no market and accrues no yield. Earn
// stays hidden on mainnet until a real strategy ships (see docs/MAINNET.md).
export const EARN_VISIBLE = env.NETWORK_MODE !== "MAINNET";
