import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryLtv, liquidationRatio, pnl } from './position-math';

test('long 1.5x: 33.3% entry LTV, liquidates after a 65.6% drop at 97% liquidation LTV', () => {
  assert.equal(entryLtv('long', 1.5).toFixed(4), '0.3333');
  assert.equal(liquidationRatio('long', 1.5).toFixed(4), '0.3436');
});

test('long 10x: 90% entry LTV, liquidates after a 7.2% drop', () => {
  assert.equal(entryLtv('long', 10).toFixed(2), '0.90');
  assert.equal(liquidationRatio('long', 10).toFixed(4), '0.9278');
});

test('short 1x: 50% entry LTV, liquidates after a 94% rise', () => {
  assert.equal(entryLtv('short', 1), 0.5);
  assert.equal(liquidationRatio('short', 1).toFixed(2), '1.94');
});

test('short 10x: 90.9% entry LTV, liquidates after a 6.7% rise', () => {
  assert.equal(entryLtv('short', 10).toFixed(3), '0.909');
  assert.equal(liquidationRatio('short', 10).toFixed(3), '1.067');
});

test('pnl is symmetric by side and freezes at the liquidation line', () => {
  assert.equal(pnl('long', 1.5, 1.1).toFixed(2), '0.15');
  assert.equal(pnl('short', 1.25, 0.9).toFixed(3), '0.125');
  assert.equal(pnl('long', 1.5, 0.2), pnl('long', 1.5, liquidationRatio('long', 1.5)));
  assert.ok(pnl('long', 1.5, 0.2) > -1);
  assert.equal(pnl('short', 1, 3), pnl('short', 1, 1.94));
});
