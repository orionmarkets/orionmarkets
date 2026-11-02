"use client";

import React, { useState } from "react";
import { ArrowUpRight, X, Loader2 } from "lucide-react";
import { useConnect, useDisconnect, useAccount } from "wagmi";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { disconnect } = useDisconnect();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet"
      className="fixed inset-0 z-50 flex items-center justify-center bg-page/85 backdrop-blur-sm p-4 font-sans"
    >
      <div className="bg-surface w-full max-w-md rounded-sm p-6 border border-ink/15 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-ink/10">
          <div>
            <span className="text-[10px] text-muted uppercase tracking-widest block">
              [WEB3 PROVIDER]
            </span>
            <h3 className="text-base font-bold text-ink font-sans uppercase">
              {isConnected ? "WALLET CONNECTED" : "CONNECT WALLET"}
            </h3>
          </div>
          <button
            aria-label="Close wallet dialog"
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isConnected ? (
          <div className="py-2 space-y-4 font-sans text-xs uppercase">
            <div className="bg-surface-subtle rounded-sm p-4 border border-ink/10 space-y-1">
              <span className="text-[10px] text-muted block">
                ACTIVE ADDRESS
              </span>
              <span className="font-sans text-sm font-bold text-brand break-all block">
                {address}
              </span>
            </div>
            <button
              onClick={() => {
                disconnect();
                onClose();
              }}
              className="w-full py-3 bg-neg-strong/10 hover:bg-neg-strong text-neg-strong hover:text-ink border border-neg-strong/30 font-bold text-xs rounded-sm transition-all uppercase tracking-widest"
            >
              DISCONNECT WALLET
            </button>
          </div>
        ) : (
          <div className="space-y-4 font-sans uppercase text-xs">
            <p className="text-[11px] text-muted leading-relaxed">
              SELECT A WEB3 PROVIDER TO EXECUTE MARGIN & DEPOSIT STRATEGIES ON
              ROBINHOOD CHAIN.
            </p>
            {connectionError && (
              <p role="alert" className="text-sm text-brand normal-case">
                {connectionError}
              </p>
            )}
            <div className="space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={async () => {
                    try {
                      setConnectionError(null);
                      if (!(await connector.getProvider())) {
                        setConnectionError(
                          "No browser wallet detected. Open this page in the browser where your wallet is installed.",
                        );
                        return;
                      }
                      await connectAsync({ connector });
                      onClose();
                    } catch {
                      setConnectionError(
                        "Wallet connection was not completed. Check your wallet and try again.",
                      );
                    }
                  }}
                  disabled={isPending}
                  className="w-full text-left p-3.5 btn-silver group flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold font-sans text-xs block">
                      {connector.name.toUpperCase()}
                    </span>
                    <span className="text-[10px] block opacity-70">
                      CONNECT VIA {connector.name}
                    </span>
                  </div>
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
