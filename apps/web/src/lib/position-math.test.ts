import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryLtv, liquidationRatio, pnl } from './position-math';

test('long 1.5x: 33.3% entry LTV, liquidates after a 48.7% drop', () => {
  assert.equal(entryLtv('long', 1.5).toFixed(4), '0.3333');
  assert.equal(liquidationRatio('long', 1.5).toFixed(4), '0.5128');
});

test('short 1x: 50% entry LTV, liquidates after a 60% rise', () => {
  assert.equal(entryLtv('short', 1), 0.5);
  assert.equal(liquidationRatio('short', 1).toFixed(2), '1.60');
});

test('pnl is symmetric by side and freezes at the liquidation line', () => {
  assert.equal(pnl('long', 1.5, 1.1).toFixed(2), '0.15');
  assert.equal(pnl('short', 1.25, 0.9).toFixed(3), '0.125');
  assert.equal(pnl('long', 1.5, 0.2), pnl('long', 1.5, liquidationRatio('long', 1.5)));
  assert.ok(pnl('long', 1.5, 0.2) > -1);
  assert.equal(pnl('short', 1, 3), pnl('short', 1, 1.6));
});
