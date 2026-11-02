'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { env } from '../env.mjs';

const truncate = (address: string) => (address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address);

/**
 * The contract address of the Orion token. Until NEXT_PUBLIC_TOKEN_CA is set it reads "Coming soon" and does nothing;
 * once set it shows the shortened address and copies the full one on click. `fullOnWide` swaps in the whole address
 * on wide screens (see .ca-chip-long in globals.css) and keeps the shortened one where the header is tight.
 */
export function CaChip({ className = '', full = false, fullOnWide = false }: { className?: string; full?: boolean; fullOnWide?: boolean }) {
  const address = (env.TOKEN_CA ?? '').trim();
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <span className={`ca-chip ca-chip-pending ${className}`} data-nav-item="" title="The contract address will be published here at launch.">
        <span className="ca-chip-label">CA</span>
        <span>Coming soon</span>
      </span>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the full address is in the title */
    }
  };

  return (
    <button type="button" className={`ca-chip fx-flare ${className}`} data-nav-item="" onClick={copy} title={address} aria-label={`Copy contract address ${address}`}>
      <span className="ca-chip-label">CA</span>
      {fullOnWide ? (
        <>
          <span className="ca-chip-value ca-chip-short">{truncate(address)}</span>
          <span className="ca-chip-value ca-chip-long">{address}</span>
        </>
      ) : (
        <span className="ca-chip-value">{full ? address : truncate(address)}</span>
      )}
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  );
}
