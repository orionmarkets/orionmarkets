'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CardLoop } from '../orion/CardLoop';
import { useReferencePrices } from '../../hooks/useReferencePrices';
import { assetCatalog } from '../../lib/asset-catalog';
import { MAX_LEVERAGE_LABEL } from '../../lib/leverage';
import { env } from '../../env.mjs';
import { AUTOPROTECT_LIVE, AUTOPROTECT_VISIBLE } from '../../lib/release';

// WebGL only on the client, after the copy has painted.
const OrionSky = dynamic(() => import('../orion/OrionSky').then((m) => m.OrionSky), { ssr: false });

const FACTS = [
  ...(AUTOPROTECT_VISIBLE ? [AUTOPROTECT_LIVE ? 'Auto-Protect keeper' : 'Auto-Protect · in validation'] : []),
  'Isolated pair per equity',
  'USDG debt · ERC-4626 vault',
  'UUPS proxies · ERC-1967',
  'Freshness-guarded oracle',
  'One-transaction long & short',
];

/** The live tape: every listed equity with its last reference quote, then the protocol facts. Loops seamlessly. */
function Tape() {
  const refs = useReferencePrices();
  const items = [
    ...assetCatalog
      .filter((a) => a.category !== 'China')
      .map((a) => ({ key: a.ticker, label: a.ticker, value: refs.last(a.ticker) ?? a.name, logo: a.image })),
    ...FACTS.map((f) => ({ key: f, label: '◆', value: f, logo: undefined })),
  ];
  const row = (hidden: boolean) => (
    <div className="tape-row" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <span className="tape-item" key={item.key}>
          {item.logo && <img className="tape-logo" src={item.logo} alt="" draggable={false} />}
          <b>{item.label}</b>
          <span>{item.value}</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="tape" role="marquee" aria-label="Live reference prices and protocol facts">
      <div className="tape-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <OrionSky className="hero-sky" />
      <div className="hero-top">
        <span className="pill pill-live">
          <i aria-hidden="true" /> Live on {env.CHAIN_NAME}
        </span>
        <span className="hero-coord">RA 05h 35m · DEC −05° 23′ · CHAIN {env.CHAIN_ID}</span>
      </div>

      <CardLoop />

      <div className="hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title" className="display-xl">
            Find your <span className="hl">edge.</span>
          </h1>
          <p className="hero-lede">
            Tokenized equities at the core. Leverage and credit around them. A new financial stack for your market
            conviction.
          </p>
          <div className="hero-cta">
            <Link href="/markets" className="landing-btn btn-lg">
              Launch app <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a href="#simulator" className="landing-btn landing-btn-outline btn-lg">
              Run the numbers
            </a>
          </div>
        </div>

        <div className="hero-actions">
          <Link href="/trade" className="action-card fx-card">
            <span className="action-kicker">01 · Take a side</span>
            <strong>Long or short tokenized stocks up to {MAX_LEVERAGE_LABEL}</strong>
            <span className="action-foot">
              One transaction in, one out <ArrowUpRight size={18} aria-hidden="true" />
            </span>
          </Link>
          <Link href="/lending" className="action-card action-card-blue fx-card">
            <span className="action-kicker">02 · Unlock credit</span>
            <strong>Post your stock. Borrow USDG. Keep the upside.</strong>
            <span className="action-foot">
              Isolated per market <ArrowUpRight size={18} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>

      <Tape />
    </section>
  );
}
