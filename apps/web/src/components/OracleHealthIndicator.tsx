import React from "react";
import type { OracleStatus } from "@/lib/pons-client";

interface OracleHealthIndicatorProps {
  status?: OracleStatus | null;
  loading?: boolean;
}

export function OracleHealthIndicator({ status, loading }: OracleHealthIndicatorProps) {
  if (loading) {
    return (
      <div className="oracle-indicator app-skeleton" style={{ width: 120, height: 24, borderRadius: 12 }} />
    );
  }

  if (!status) {
    return (
      <div className="oracle-indicator unknown">
        <span className="dot" />
        <span>Oracle: Unknown</span>
      </div>
    );
  }

  const { isSafe, deviationBps } = status;
  const deviationPct = (deviationBps / 100).toFixed(2);
  
  // Choose class based on status
  let className = "oracle-indicator";
  if (status.status === "HEALTHY") className += " healthy";
  if (status.status === "WARNING") className += " warning";
  if (status.status === "CRITICAL") className += " critical";

  return (
    <div className={className} title={`TWAP Deviation: ${deviationPct}%`}>
      <span className="dot" />
      <span>
        {status.status === "HEALTHY" && "Oracle: Healthy"}
        {status.status === "WARNING" && "Oracle: High Volatility"}
        {status.status === "CRITICAL" && "Oracle: Unsafe Deviation"}
      </span>
      {!isSafe && <span className="deviation-warn">({deviationPct}%)</span>}
      
      <style>{`
        .oracle-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: color-mix(in srgb, var(--ink) 4%, transparent);
          border: 1px solid var(--line);
          color: var(--muted);
        }
        .oracle-indicator .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        .oracle-indicator.healthy {
          color: var(--go);
          background: color-mix(in srgb, var(--go) 10%, transparent);
          border-color: color-mix(in srgb, var(--go) 25%, transparent);
        }
        .oracle-indicator.warning {
          color: var(--warn);
          background: color-mix(in srgb, var(--warn) 10%, transparent);
          border-color: color-mix(in srgb, var(--warn) 20%, transparent);
        }
        .oracle-indicator.critical {
          color: var(--danger);
          background: color-mix(in srgb, var(--neg) 10%, transparent);
          border-color: color-mix(in srgb, var(--neg) 20%, transparent);
        }
        .deviation-warn {
          margin-left: 4px;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
