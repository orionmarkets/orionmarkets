'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useReferencePrices } from '../../hooks/useReferencePrices';
import { assetCatalog, marketPath } from '../../lib/asset-catalog';

const GROUPS = [
  { id: 'stocks', title: 'US Stocks', note: 'Single-name US equities, one isolated pair each.', match: (c?: string) => c === undefined },
  { id: 'etfs', title: 'ETFs', note: 'Index, treasury and silver funds as tokens.', match: (c?: string) => c === 'ETFs' },
  { id: 'china', title: 'China Exposure', note: 'Chinese large caps, priced in USD.', match: (c?: string) => c === 'China' },
]
  .map((g) => ({ ...g, assets: assetCatalog.filter((a) => g.match(a.category)) }))
  .filter((g) => g.assets.length > 0);

/** The market coverage right under the hero: every listed group with its logos and live reference quotes. */
export function Coverage() {
  const refs = useReferencePrices();
  return (
    <section id="coverage" className="sf-section" aria-labelledby="coverage-title">
      <div className="sf-card sf-panel">
        <header className="sf-intro">
          <span className="sf-eyebrow">{GROUPS.map((g) => g.title).join(' · ')}</span>
          <h2 id="coverage-title" className="display-lg">
            See what you can trade.
          </h2>
        </header>
        <div className="cov-grid">
          {GROUPS.map((g) => (
            <section key={g.id} className="cov-group" aria-labelledby={`cov-${g.id}`}>
              <header>
                <h3 id={`cov-${g.id}`}>{g.title}</h3>
                <span className="cov-count">{String(g.assets.length).padStart(2, '0')}</span>
              </header>
              <p>{g.note}</p>
              <ul>
                {g.assets.map((a) => (
                  <li key={a.ticker}>
                    <Link href={marketPath(a.ticker)} className="cov-row">
                      <img className="cov-logo" src={a.image} alt="" draggable={false} />
                      <span className="cov-name">
                        <b>{a.ticker}</b>
                        <small>{a.name}</small>
                      </span>
                      <span className="cov-price">{refs.last(a.ticker) ?? '—'}</span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
