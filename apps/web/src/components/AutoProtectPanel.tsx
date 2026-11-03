"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { useAutoProtect } from "../hooks/useAutoProtect";
import type { MarketDeployment } from "../lib/market-deployments";

/** Set or switch off the Auto-Protect rule of the connected wallet on one lending market. */
export function AutoProtectPanel({ market }: { market: MarketDeployment }) {
  const { rule, allowance, loading, busy, save, topUp } = useAutoProtect(market);
  const [trigger, setTrigger] = useState("55");
  const [target, setTarget] = useState("40");
  const [maxRepay, setMaxRepay] = useState("");
  const [error, setError] = useState("");
  const symbol = market.long.debtSymbol;
  const [isOn, triggerBps, targetBps, maxRaw] = rule ?? [false, 0n, 0n, 0n];

  const t = Number(trigger);
  const g = Number(target);
  const invalid =
    !(t > 0 && t <= 95) || !(g > 0 && g < t) || !(Number(maxRepay) > 0)
      ? "Trigger 1 to 95%, target below the trigger, and a repayment limit above 0."
      : "";

  const shortAllowance = isOn && (allowance ?? 0n) < maxRaw;

  async function reapprove() {
    setError("");
    try {
      await topUp(maxRaw);
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed");
    }
  }

  async function submit(on: boolean) {
    setError("");
    try {
      if (on) await save(t, g, maxRepay, true);
      else await save(Number(triggerBps) / 100 || 55, Number(targetBps) / 100 || 40, "0", false);
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed");
    }
  }

  return (
    <section className="app-panel" aria-labelledby="autoprotect-title">
      <span id="autoprotect-title" className="app-eyebrow">
        Auto-Protect · {market.symbol}
      </span>
      <p className="app-note">
        When your loan ratio reaches the trigger, a keeper repays part of your debt from your own wallet&apos;s {symbol},
        up to the limit you set, until the ratio is back at the target. If your wallet balance or allowance is short, nothing
        happens and the position can still be liquidated. It covers your loan on this market only, not margin short positions,
        and the keeper checks about every ten seconds.
      </p>
      {loading ? (
        <p className="app-note">Reading your rule…</p>
      ) : isOn ? (
        <p className="app-note" role="status">
          Active: trigger {Number(triggerBps) / 100}%, target {Number(targetBps) / 100}%, limit{" "}
          {formatUnits(maxRaw, market.long.debtDecimals)} {symbol}. Allowance to the module:{" "}
          {formatUnits(allowance ?? 0n, market.long.debtDecimals)} {symbol}.
        </p>
      ) : (
        <p className="app-note">No rule set for this market.</p>
      )}
      {shortAllowance && (
        <p className="app-note" role="alert">
          {(allowance ?? 0n) === 0n
            ? "Your allowance is used up, so Auto-Protect cannot repay anything."
            : "Your allowance is below your repayment limit, so Auto-Protect can repay less than the limit."}{" "}
          Each repayment spends allowance.
          <button type="button" className="app-button" disabled={busy} onClick={reapprove}>
            Re-approve {formatUnits(maxRaw, market.long.debtDecimals)} {symbol}
          </button>
        </p>
      )}
      <div>
        <label className="app-eyebrow" htmlFor="ap-trigger">Trigger loan ratio (%)</label>
        <input id="ap-trigger" className="lending-input" inputMode="decimal" value={trigger} onChange={(e) => setTrigger(e.target.value)} disabled={busy} />
        <label className="app-eyebrow" htmlFor="ap-target">Target loan ratio (%)</label>
        <input id="ap-target" className="lending-input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy} />
        <label className="app-eyebrow" htmlFor="ap-max">Repayment limit ({symbol})</label>
        <input id="ap-max" className="lending-input" inputMode="decimal" placeholder="Enter amount" value={maxRepay} onChange={(e) => setMaxRepay(e.target.value)} disabled={busy} />
      </div>
      {(invalid || error) && (
        <p className="app-note" role="alert">
          {error || invalid}
        </p>
      )}
      <button type="button" className="app-button" disabled={busy || Boolean(invalid)} onClick={() => submit(true)}>
        {busy ? "Confirm in wallet…" : isOn ? "Update rule" : "Enable Auto-Protect"}
      </button>
      {isOn && (
        <button type="button" className="app-button" disabled={busy} onClick={() => submit(false)}>
          Switch off
        </button>
      )}
    </section>
  );
}
