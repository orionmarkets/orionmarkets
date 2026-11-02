import {
  publicClient,
  walletClient,
  keeperAccount,
  AutoProtectABI,
  OrionPairABI,
  ERC20ABI,
} from "../client.js";
import { config } from "../config.js";
import { BreachCandidate } from "./positionMonitor.js";
import { formatGwei, formatUnits, parseUnits, Address } from "viem";

export async function executeCandidateProtection(
  candidate: BreachCandidate,
): Promise<boolean> {
  if (!config.TRADING_ENABLED) return false;
  try {
    if ((await publicClient.getChainId()) !== config.CHAIN_ID) return false;
    // 1. Gas Ceiling Check
    const gasPrice = await publicClient.getGasPrice();
    const gasPriceGwei = parseFloat(formatGwei(gasPrice));

    if (gasPriceGwei > config.MAX_GAS_PRICE_GWEI) {
      console.warn(
        `[KEEPER GAS CEILING] Current gas price (${gasPriceGwei.toFixed(2)} Gwei) ` +
          `exceeds ceiling limit (${config.MAX_GAS_PRICE_GWEI} Gwei). Skipping execution.`,
      );
      return false;
    }

    // 2. Check Keeper Authorization
    let isAuthorized = false;
    try {
      isAuthorized = await publicClient.readContract({
        address: config.AUTO_PROTECT_ADDRESS as Address,
        abi: AutoProtectABI,
        functionName: "isKeeper",
        args: [keeperAccount.address],
      });

      if (!isAuthorized) {
        const contractOwner = await publicClient.readContract({
          address: config.AUTO_PROTECT_ADDRESS as Address,
          abi: AutoProtectABI,
          functionName: "owner",
        });
        isAuthorized =
          contractOwner.toLowerCase() === keeperAccount.address.toLowerCase();
      }
    } catch (authErr) {
      console.warn(
        "[KEEPER AUTH CHECK] Read failed; provider details redacted.",
      );
    }

    if (!isAuthorized) {
      console.error(
        `[KEEPER AUTH ERROR] Keeper account (${keeperAccount.address}) is not authorized on AutoProtectModule!`,
      );
      return false;
    }

    // 3. Get Pair's Debt Token (USDG)
    const debtTokenAddress = await publicClient.readContract({
      address: candidate.pairAddress,
      abi: OrionPairABI,
      functionName: "debtToken",
    });

    const decimals = await publicClient.readContract({
      address: debtTokenAddress,
      abi: ERC20ABI,
      functionName: "decimals",
    });

    // 4. Debt scales linearly with the loan ratio, so repaying (current - target) / current of it restores the target.
    //    Rounded up; the module caps the repayment at what the target needs.
    const currentBps = BigInt(Math.round(candidate.currentLtvPercent * 100));
    const targetBps = BigInt(Math.round(candidate.targetLtvPercent * 100));
    let repayAmount =
      currentBps > targetBps
        ? (candidate.debtAmount * (currentBps - targetBps) + currentBps - 1n) / currentBps
        : 0n;

    if (repayAmount > candidate.maxDeleverage && candidate.maxDeleverage > 0n) {
      repayAmount = candidate.maxDeleverage;
    }

    if (repayAmount <= 0n) {
      console.log(
        `[KEEPER] No debt reduction required for ${candidate.userAddress}`,
      );
      return false;
    }

    // 5. The borrower pays: cap the repayment to what their wallet holds and has approved to the module.
    const [balance, allowance] = await Promise.all([
      publicClient.readContract({
        address: debtTokenAddress,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [candidate.userAddress],
      }),
      publicClient.readContract({
        address: debtTokenAddress,
        abi: ERC20ABI,
        functionName: "allowance",
        args: [candidate.userAddress, config.AUTO_PROTECT_ADDRESS as Address],
      }),
    ]);
    const payable = balance < allowance ? balance : allowance;
    if (payable < repayAmount) repayAmount = payable;
    if (repayAmount <= 0n) {
      console.warn(
        `[KEEPER] ${candidate.userAddress} has no approved ${candidate.pairAddress} debt token to repay with; skipping.`,
      );
      return false;
    }

    // 6. Submit executeAutoProtect on-chain
    console.log(
      `[KEEPER EXECUTE] Deleveraging ${candidate.userAddress} on ${candidate.pairAddress}: ` +
        `Repaying ${formatUnits(repayAmount, decimals)} USDG...`,
    );

    const txHash = await walletClient.writeContract({
      address: config.AUTO_PROTECT_ADDRESS as Address,
      abi: AutoProtectABI,
      functionName: "executeAutoProtect",
      args: [candidate.pairAddress, candidate.userAddress, repayAmount],
    });

    console.log(
      `[KEEPER TX SUBMITTED] Hash: ${txHash}. Waiting for confirmation...`,
    );
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const gasUsed = receipt.gasUsed;
    const effectiveGasPrice = receipt.effectiveGasPrice || gasPrice;
    const gasCostEth = parseFloat(formatUnits(gasUsed * effectiveGasPrice, 18));
    const gasCostUsd = gasCostEth * 3500; // estimated ETH price

    console.log(
      `[KEEPER SUCCESS] Tx confirmed in block ${receipt.blockNumber}! Gas used: ${gasUsed.toString()} (${gasCostEth.toFixed(6)} ETH / ~$${gasCostUsd.toFixed(2)})`,
    );

    return true;
  } catch (err: any) {
    console.error(
      "[KEEPER EXECUTION FAILED] Transaction could not complete; private details redacted.",
    );
    return false;
  }
}
