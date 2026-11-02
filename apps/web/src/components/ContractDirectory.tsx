'use client';

import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { env } from '../env.mjs';
import { buildContractDirectory, explorerAddressUrl, type ContractEntry, type ContractGroup } from '../lib/contract-directory';

function ContractRow({ contract }: { contract: ContractEntry }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contract.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the address is on screen and selectable */
    }
  };

  return (
    <li className="contract-row">
      <div className="contract-id">
        <span className="contract-name">{contract.name}</span>
        <code className="contract-address">{contract.address}</code>
      </div>
      <div className="contract-actions">
        <button
          type="button"
          className="ca-chip contract-copy"
          onClick={copy}
          aria-label={`Copy ${contract.name} address`}
          title={copied ? 'Copied' : 'Copy address'}
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        </button>
        <a
          className="ca-chip contract-link"
          href={explorerAddressUrl(contract.address)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${contract.name} on Blockscout`}
        >
          Blockscout
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

/** One group of contracts: title, count, a line on what it is for, and a row per contract with copy and Blockscout. */
export function ContractGroupCard({ group }: { group: ContractGroup }) {
  return (
    <section className="contract-group" aria-labelledby={`contracts-${group.id}`}>
      <header className="contract-group-head">
        <h3 id={`contracts-${group.id}`} className="contract-group-title">
          {group.title}
        </h3>
        <span className="contract-group-count">{String(group.contracts.length).padStart(2, '0')}</span>
      </header>
      <p className="landing-body contract-group-note">{group.note}</p>
      <ul className="contract-list">
        {group.contracts.map((contract) => (
          <ContractRow key={contract.address} contract={contract} />
        ))}
      </ul>
    </section>
  );
}

/** The contract groups of this build's network, built once per mount. */
export function useContractDirectory() {
  return useMemo(() => {
    const groups = buildContractDirectory();
    return { groups, total: groups.reduce((sum, group) => sum + group.contracts.length, 0) };
  }, []);
}

/** The Blockscout home of this build's network. */
export const explorerHome = () => env.EXPLORER_URL.replace(/\/$/, '');

/**
 * Every contract the app uses on this build's network, grouped (core first, then one group per market, then Pons), for
 * the /contracts page.
 */
export function ContractDirectory() {
  const { groups, total } = useContractDirectory();
  if (total === 0) {
    return <p className="landing-body">No contracts are configured for {env.CHAIN_NAME} in this build.</p>;
  }

  return (
    <div className="contracts-page">
      <div className="contracts-head">
        <p className="landing-body max-w-[680px]">
          All {total} contracts ORIONMARKETS uses on {env.CHAIN_NAME} (chain ID {env.CHAIN_ID}), in {groups.length}{' '}
          {groups.length === 1 ? 'group' : 'groups'}. Open any address on Blockscout to check its code, transactions and
          balances for yourself.
        </p>
        <a className="ca-chip contract-link" href={explorerHome()} target="_blank" rel="noopener noreferrer">
          Open Blockscout
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
      <div className="contracts-grid">
        {groups.map((group) => (
          <ContractGroupCard key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}
