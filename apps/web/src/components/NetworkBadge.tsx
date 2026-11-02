'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { NetworkMode } from '@orion/types';
import { ChevronDown } from 'lucide-react';
import { useNetworkMode } from '../hooks/useNetworkMode';
import { NETWORK_CHAIN_IDS } from '../lib/networks';
import { networkSwitchHref } from '../lib/network-switch';

const OPTIONS: Array<{ mode: NetworkMode; label: string }> = [
  { mode: 'MAINNET', label: 'Robinhood Chain Mainnet' },
  { mode: 'TESTNET', label: 'Robinhood Chain Testnet' },
];

/**
 * Network dropdown. The network is fixed when the app is built (NETWORK_MODE), so the current entry is a status label
 * and the other one opens the same page on the other deployment (www for mainnet, testnet. for testnet).
 */
export function NetworkBadge({ className = '' }: { className?: string }) {
  const { networkMode } = useNetworkMode();
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.mode === networkMode) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={`net-menu ${className}`} data-network={networkMode.toLowerCase()}>
      <button
        type="button"
        className="net-menu-trigger"
        data-nav-item=""
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Network: ${current.label}, chain ${NETWORK_CHAIN_IDS[current.mode]}. Change network`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="net-badge-dot" aria-hidden="true" />
        <span>{current.label}</span>
        <span className="net-menu-chain">{NETWORK_CHAIN_IDS[current.mode]}</span>
        <ChevronDown size={13} aria-hidden="true" className="net-menu-chevron" />
      </button>
      {open && (
        <div className="net-menu-list" role="group" aria-label="Network">
          {OPTIONS.map(({ mode, label }) => {
            const inner = (
              <>
                <span className="net-badge-dot" aria-hidden="true" />
                <span className="net-menu-name">{label}</span>
                <span className="net-menu-chain">{NETWORK_CHAIN_IDS[mode]}</span>
              </>
            );
            return mode === networkMode ? (
              <span key={mode} className="net-menu-item" data-network={mode.toLowerCase()} data-active="true" aria-current="true">
                {inner}
              </span>
            ) : (
              <a key={mode} className="net-menu-item" data-network={mode.toLowerCase()} href={networkSwitchHref(mode, pathname)} onClick={() => setOpen(false)}>
                {inner}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
