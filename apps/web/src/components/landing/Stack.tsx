'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { env } from '../../env.mjs';
import { ContractGroupCard, useContractDirectory } from '../ContractDirectory';

const LAYERS = [
  { name: 'Execution', items: ['OrionRouter', 'LeverageRouter', 'ShortRouter', 'MarginRouter'], note: 'Atomic borrow · swap · post' },
  { name: 'Markets', items: ['OrionPair · long', 'OrionPair · short'], note: 'One isolated pair per side, per equity' },
  { name: 'Risk', items: ['OrionMarketRegistry', 'Reference oracle', 'AutoProtectModule'], note: 'Tiers, caps, freshness, keeper' },
  { name: 'Vault', items: ['OrionVault · ERC-4626'], note: 'USDG custody layer for credit' },
];

const SPECS = ['Solidity 0.8.24 · via-IR', 'UUPS upgradeable', 'ERC-1967 proxies', 'ERC-4626 vault', '152 Foundry tests', 'Verified on Blockscout'];

/** The protocol as layers, beside the live list of core contracts on this network. */
export function Stack() {
  const { groups, total } = useContractDirectory();
  const core = groups.find((g) => g.id === 'core');

  return (
    <section id="contracts" className="sf-section" aria-labelledby="stack-title">
      <header className="sf-intro">
        <span className="sf-eyebrow">Onchain, verifiable</span>
        <h2 id="stack-title" className="display-lg">
          Every contract, <span className="hl">in the open.</span>
        </h2>
        <p className="section-lede">
          The contracts behind every ORIONMARKETS position on {env.CHAIN_NAME} · chain {env.CHAIN_ID}. Copy an address,
          open it on Blockscout, read the code.
        </p>
        {total > 0 && (
          <Link href="/contracts" className="sf-btn sf-btn-light">
            All {total} contracts <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </header>

      <div className="sf-split">
        <div className="sf-card sf-copy theme-light">
          <span className="sf-eyebrow">Protocol layers</span>
          <div className="stack-layers">
            {LAYERS.map((l) => (
              <div key={l.name} className="stack-layer">
                <span className="stack-layer-name">{l.name}</span>
                <div className="stack-layer-items">
                  {l.items.map((it) => (
                    <code key={it}>{it}</code>
                  ))}
                </div>
                <small>{l.note}</small>
              </div>
            ))}
          </div>
          <ul className="spec-list">
            {SPECS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        {core && (
          <div className="sf-card sf-contracts theme-inverse">
            <ContractGroupCard group={core} />
          </div>
        )}
      </div>
    </section>
  );
}
