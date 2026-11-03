/**
 * Position math for the landing simulator, in price ratios (p = price / entry price). Mirrors the protocol mechanics:
 * a long borrows USDG against the stock it buys, a short borrows the stock and holds USDG collateral.
 */
export type Side = 'long' | 'short';

/** Testnet TSLA policy: both pairs liquidate at 97% LTV (packages/contracts/deployments, scripts/testnet-glue.mjs). */
export const LIQ_LTV: Record<Side, number> = { long: 0.97, short: 0.97 };
export const LEVERAGES: Record<Side, number[]> = { long: [2, 5, 10], short: [2, 5, 10] };

export function entryLtv(side: Side, lev: number): number {
  return side === 'long' ? (lev - 1) / lev : lev / (1 + lev);
}

/** Price ratio at which the position reaches its liquidation LTV. */
export function liquidationRatio(side: Side, lev: number): number {
  return side === 'long' ? (lev - 1) / (lev * LIQ_LTV.long) : (LIQ_LTV.short * (1 + lev)) / lev;
}

/** Profit or loss in margin units at price ratio p. Past the liquidation price the position is closed, so the loss
 * stays at its value on the liquidation line. */
export function pnl(side: Side, lev: number, p: number): number {
  const liq = liquidationRatio(side, lev);
  const at = side === 'long' ? Math.max(p, liq) : Math.min(p, liq);
  return side === 'long' ? lev * (at - 1) : -lev * (at - 1);
}
