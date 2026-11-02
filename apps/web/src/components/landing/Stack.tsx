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
    <section id="contracts" className="landing-section" aria-labelledby="stack-title">
      <header className="section-head section-head-row">
        <div>
          <span className="kicker">Onchain, verifiable</span>
          <h2 id="stack-title" className="display-lg">
            Every contract, <span className="hl">in the open.</span>
          </h2>
          <p className="section-lede">
            The contracts behind every ORIONMARKETS position on {env.CHAIN_NAME} · chain {env.CHAIN_ID}. Copy an address,
            open it on Blockscout, read the code.
          </p>
        </div>
        {total > 0 && (
          <Link href="/contracts" className="landing-btn landing-btn-outline">
            All {total} contracts <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </header>

      <div className="stack-grid">
        <div className="stack-layers">
          {LAYERS.map((l, i) => (
            <div key={l.name} className="stack-layer" style={{ ['--i' as string]: i }}>
              <span className="stack-layer-name">{l.name}</span>
              <div className="stack-layer-items">
                {l.items.map((it) => (
                  <code key={it}>{it}</code>
                ))}
              </div>
              <small>{l.note}</small>
            </div>
          ))}
          <ul className="spec-list spec-list-wide">
            {SPECS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        {core && (
          <div className="contracts-grid">
            <ContractGroupCard group={core} />
          </div>
        )}
      </div>
    </section>
  );
}
