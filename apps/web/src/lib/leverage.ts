import { env } from '../env.mjs';
import type { MarketDeployment } from './market-deployments';

/** Highest multiple (bps, 10000 = 1x) the network's margin policy offers; the policy is the source of truth. */
function maxBps(side: 'longLeveragesBps' | 'shortExposureBps'): number {
  const policies = [env.MARGIN_DEPLOYMENT_JSON, ...(env.MARKET_DEPLOYMENTS_JSON as MarketDeployment[]).map((m) => m.margin)].map((m) => m?.policy);
  return Math.max(0, ...policies.flatMap((p) => p?.[side] ?? []));
}
const label = (bps: number) => `${bps / 10000}×`;

// shortcut: falls back to 10× when no margin policy is configured (marketing copy only), drop once every env sets one.
export const MAX_LEVERAGE_LABEL = label(maxBps('longLeveragesBps') || 100000);
export const MAX_SHORT_LABEL = label(maxBps('shortExposureBps') || 100000);
