import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { assetCatalog } from '../../lib/asset-catalog';
import { MAX_LEVERAGE_LABEL } from '../../lib/leverage';

const EQUITIES = assetCatalog.filter((a) => a.category !== 'China');

/** The three product pillars as one bento: equities in the middle of the story, leverage and credit around them. */
export function Pillars() {
  return (
    <section id="features" className="landing-section" aria-labelledby="pillars-title">
      <header className="section-head section-head-split">
        <span className="kicker">The stack</span>
        <h2 id="pillars-title" className="display-lg">
          Equities at the core. <span className="hl">Leverage and credit</span> around them.
        </h2>
        <dl className="head-specs">
          <div>
            <dt>Collateral</dt>
            <dd>Tokenized ERC-20 equities</dd>
          </div>
          <div>
            <dt>Debt asset</dt>
            <dd>USDG · 6 decimals</dd>
          </div>
          <div>
            <dt>Market model</dt>
            <dd>Isolated pair per side</dd>
          </div>
          <div>
            <dt>Upgrades</dt>
            <dd>UUPS behind ERC-1967</dd>
          </div>
        </dl>
      </header>

      <div className="bento">
        <Link href="/markets" className="bento-tile bento-equities fx-card">
          <span className="bento-tag">Pillar I</span>
          <h3>Tokenized equities</h3>
          <p>
            Real stock exposure as ERC-20s on Robinhood Chain. Every listing runs in its own isolated pair, so one
            market&apos;s volatility never leaks into another.
          </p>
          <div className="bento-logos">
            {EQUITIES.map((a) => (
              <span key={a.ticker} className={`bento-logo ${a.className}`} title={a.name}>
                <img src={a.image} alt="" />
                <b>{a.ticker}</b>
              </span>
            ))}
          </div>
          <span className="bento-go">
            Browse markets <ArrowUpRight size={16} aria-hidden="true" />
          </span>
        </Link>

        <Link href="/trade" className="bento-tile bento-trade fx-card">
          <span className="bento-tag">Pillar II</span>
          <h3>Leveraged long / short</h3>
          <p>Directional conviction, sized. Long up to {MAX_LEVERAGE_LABEL}, short up to 1.25×, opened and closed atomically through the margin router.</p>
          <div className="bento-split" aria-hidden="true">
            <span className="bento-long">
              <b>Long</b> 1.25× · 1.5×
            </span>
            <span className="bento-short">
              <b>Short</b> 1.0× · 1.25×
            </span>
          </div>
          <span className="bento-go">
            Open the terminal <ArrowUpRight size={16} aria-hidden="true" />
          </span>
        </Link>

        <Link href="/lending" className="bento-tile bento-credit fx-card">
          <span className="bento-tag">Pillar III</span>
          <h3>Borrowing &amp; credit</h3>
          <p>Post stock, draw USDG at up to 50% LTV, stay invested. Lenders supply USDG and earn the borrow side.</p>
          <div className="bento-gauge" aria-hidden="true">
            <span style={{ ['--v' as string]: '50%' }} />
            <i style={{ ['--v' as string]: '65%' }} />
            <small>
              <b>50%</b> max LTV · <b>65%</b> liquidation LTV
            </small>
          </div>
          <span className="bento-go">
            Unlock credit <ArrowUpRight size={16} aria-hidden="true" />
          </span>
        </Link>
      </div>
    </section>
  );
}
