import Link from 'next/link';
import { ArrowUpDown, ArrowUpRight, CandlestickChart, Landmark } from 'lucide-react';
import { assetCatalog } from '../../lib/asset-catalog';
import { MAX_LEVERAGE_LABEL } from '../../lib/leverage';

const EQUITIES = assetCatalog.filter((a) => a.category !== 'China');

const PILLARS = [
  {
    href: '/markets',
    tone: 'lime',
    Icon: CandlestickChart,
    tag: 'Pillar I · Real stock exposure',
    title: 'Tokenized equities',
    body: "ERC-20 stocks on Robinhood Chain. Every listing runs in its own isolated pair, so one market's volatility never leaks into another.",
  },
  {
    href: '/trade',
    tone: 'blue',
    Icon: ArrowUpDown,
    tag: 'Pillar II · Directional conviction',
    title: 'Leveraged long / short',
    body: `Long up to ${MAX_LEVERAGE_LABEL}, short up to 1.25×, opened and closed atomically through the margin router.`,
  },
  {
    href: '/lending',
    tone: 'mist',
    Icon: Landmark,
    tag: 'Pillar III · Stay invested',
    title: 'Borrowing & credit',
    body: 'Post your stock, draw USDG at up to 50% LTV. Repay and withdraw whenever you choose.',
  },
];

/** The three product pillars as colour tiles inside one light panel. */
export function Pillars() {
  return (
    <section id="features" className="sf-section" aria-labelledby="pillars-title">
      <div className="sf-card sf-panel theme-light">
        <header className="sf-intro">
          <span className="sf-eyebrow">The stack</span>
          <h2 id="pillars-title" className="display-lg">
            Equities at the core. Leverage and credit around them.
          </h2>
        </header>
        <div className="sf-tiles">
          {PILLARS.map(({ href, tone, Icon, tag, title, body }) => (
            <Link key={href} href={href} className="sf-tile">
              <span className={`sf-tile-art sf-tone-${tone}`} aria-hidden="true">
                <span className="sf-tile-icon">
                  <Icon strokeWidth={1.6} />
                </span>
              </span>
              <span className="sf-eyebrow">{tag}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </Link>
          ))}
        </div>
        <div className="sf-logos" aria-label="Listed equities">
          {EQUITIES.map((a) => (
            <span key={a.ticker} className={`sf-logo ${a.className}`} title={a.name}>
              <img src={a.image} alt="" />
              <b>{a.ticker}</b>
            </span>
          ))}
        </div>
        <div className="sf-actions">
          <Link href="/markets" className="sf-btn">
            Browse markets <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
