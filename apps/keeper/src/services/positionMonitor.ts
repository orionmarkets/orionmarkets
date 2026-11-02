import { publicClient, AutoProtectABI, AutoProtectEvents, OrionPairABI } from '../client.js';
import { config } from '../config.js';
import { Address } from 'viem';

export interface BreachCandidate {
  userAddress: Address;
  pairAddress: Address;
  debtAmount: bigint;
  collateralValueUsd: bigint;
  currentLtvPercent: number;
  triggerLtvPercent: number;
  targetLtvPercent: number;
  maxDeleverage: bigint;
}

// Borrowers with a rule are found from the module's own ConfigUpdated logs, so chain state is the only source of truth.
const rules = new Map<string, { user: Address; pair: Address }>();
let nextBlock = BigInt(config.AUTO_PROTECT_START_BLOCK);
const LOG_RANGE = 10_000n; // shortcut: fixed range keeps getLogs under public RPC limits, raise if the node allows more.

async function refreshRules() {
  const head = await publicClient.getBlockNumber();
  while (nextBlock <= head) {
    const toBlock = nextBlock + LOG_RANGE - 1n < head ? nextBlock + LOG_RANGE - 1n : head;
    const logs = await publicClient.getLogs({
      address: config.AUTO_PROTECT_ADDRESS as Address,
      event: AutoProtectEvents[0],
      fromBlock: nextBlock,
      toBlock,
    });
    for (const log of logs) {
      const { user, pair } = log.args;
      if (user && pair) rules.set(`${user}:${pair}`.toLowerCase(), { user, pair });
    }
    nextBlock = toBlock + 1n;
  }
}

export async function scanPositions(): Promise<BreachCandidate[]> {
  const candidates: BreachCandidate[] = [];
  try {
    await refreshRules();
  } catch {
    console.error('[KEEPER MONITOR] Could not read rule logs; provider details redacted.');
    return candidates;
  }

  for (const { user, pair } of rules.values()) {
    try {
      const [isEnabled, triggerLtvBps, targetLtvBps, maxDeleverage] = await publicClient.readContract({
        address: config.AUTO_PROTECT_ADDRESS as Address,
        abi: AutoProtectABI,
        functionName: 'userConfigs',
        args: [user, pair],
      });
      if (!isEnabled || triggerLtvBps === 0n) continue;

      const [, debtAmount, collateralValueUsd] = await publicClient.readContract({
        address: pair,
        abi: OrionPairABI,
        functionName: 'getPosition',
        args: [user],
      });
      if (collateralValueUsd === 0n || debtAmount === 0n) continue;

      const currentLtvBps = (debtAmount * 10_000n) / collateralValueUsd;
      if (currentLtvBps < triggerLtvBps) continue;
      console.warn(
        `[KEEPER ALERT] ${user} on ${pair}: LTV ${Number(currentLtvBps) / 100}% >= trigger ${Number(triggerLtvBps) / 100}%`,
      );
      candidates.push({
        userAddress: user,
        pairAddress: pair,
        debtAmount,
        collateralValueUsd,
        currentLtvPercent: Number(currentLtvBps) / 100,
        triggerLtvPercent: Number(triggerLtvBps) / 100,
        targetLtvPercent: Number(targetLtvBps) / 100,
        maxDeleverage,
      });
    } catch {
      // A pair that reverts (paused, stale oracle) is retried on the next cycle.
      continue;
    }
  }
  return candidates;
}
