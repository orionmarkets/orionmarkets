"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { erc20Abi, parseUnits, type Address } from "viem";
import { AutoProtectModuleABI } from "../contracts/generated/modules";
import { env } from "../env.mjs";
import type { MarketDeployment } from "../lib/market-deployments";

const MODULE = env.PROTOCOL_ADDRESSES.autoProtect as Address;

/**
 * A borrower's Auto-Protect rule for one market. The module repays from the borrower's own wallet, so enabling a rule
 * means a debt-token allowance to the module plus `setConfig`; the keeper reads the rule from chain, nothing else is stored.
 */
export function useAutoProtect(market: MarketDeployment) {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const pair = market.long.pair;
  const debt = market.long.debt;
  const enabled = Boolean(address && MODULE);

  const rule = useReadContract({
    address: MODULE,
    abi: AutoProtectModuleABI,
    functionName: "userConfigs",
    args: address ? [address, pair] : undefined,
    query: { enabled, refetchInterval: env.UI_POLL_INTERVAL_MS },
  });
  const allowance = useReadContract({
    address: debt,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, MODULE] : undefined,
    query: { enabled, refetchInterval: env.UI_POLL_INTERVAL_MS },
  });

  async function wait(hash: `0x${string}`) {
    const receipt = await client?.waitForTransactionReceipt({ hash });
    if (receipt?.status !== "success") throw new Error("Transaction reverted");
  }

  /** Percent inputs are whole or decimal percents (55 = 55%); `maxRepay` is in debt-token units as typed. */
  async function save(triggerPct: number, targetPct: number, maxRepay: string, isEnabled: boolean) {
    const trigger = BigInt(Math.round(triggerPct * 100));
    const target = BigInt(Math.round(targetPct * 100));
    const max = parseUnits(maxRepay || "0", market.long.debtDecimals);
    setBusy(true);
    try {
      if (isEnabled && (allowance.data ?? 0n) < max)
        await wait(await writeContractAsync({ address: debt, abi: erc20Abi, functionName: "approve", args: [MODULE, max] }));
      await wait(
        await writeContractAsync({
          address: MODULE,
          abi: AutoProtectModuleABI,
          functionName: "setConfig",
          args: [pair, isEnabled, trigger, target, isEnabled ? max : 0n],
        }),
      );
      await Promise.all([rule.refetch(), allowance.refetch()]);
    } finally {
      setBusy(false);
    }
  }

  /** Restores the allowance to the rule's limit after the keeper has used it up. */
  async function topUp(limit: bigint) {
    setBusy(true);
    try {
      await wait(await writeContractAsync({ address: debt, abi: erc20Abi, functionName: "approve", args: [MODULE, limit] }));
      await allowance.refetch();
    } finally {
      setBusy(false);
    }
  }

  return { rule: rule.data, allowance: allowance.data, loading: rule.isPending, busy, save, topUp };
}
