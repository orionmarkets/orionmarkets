'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useReferencePrices } from '../../hooks/useReferencePrices';
import { assetCatalog } from '../../lib/asset-catalog';
import { Constellation } from '../orion/Constellation';
import { entryLtv, liquidationRatio, LIQ_LTV } from '../../lib/position-math';

const FEATURED = assetCatalog.filter((a) => a.featured);

function ObserveVisual() {
  const refs = useReferencePrices();
  return (
    <ul className="hunt-feed">
      {FEATURED.map((a, i) => (
        <li key={a.ticker} style={{ animationDelay: `${i * 0.35}s` }}>
          <img src={a.image} alt="" />
          <b>{a.ticker}</b>
          <span className="num">{refs.last(a.ticker) ?? a.name}</span>
          <i aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}

function AimVisual() {
  const [lev, setLev] = useState(1.5);
  const ltv = entryLtv('long', lev) * 100;
  const move = (1 - liquidationRatio('long', lev)) * 100;
  return (
    <div className="hunt-aim">
      <div className="hunt-aim-chips" role="radiogroup" aria-label="Long leverage">
        {[1.25, 1.5].map((x) => (
          <button key={x} type="button" role="radio" aria-checked={lev === x} onClick={() => setLev(x)} className="chip">
            {x}× long
          </button>
        ))}
      </div>
      <dl>
        <div>
          <dt>Entry LTV</dt>
          <dd className="num">{ltv.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Liquidation move</dt>
          <dd className="num">↓ {move.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Exposure / 1k USDG</dt>
          <dd className="num">${(lev * 1000).toLocaleString('en-US')}</dd>
        </div>
      </dl>
      <div className="hunt-aim-bar" style={{ ['--w' as string]: `${ltv / LIQ_LTV.long}%` }} aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

const TX_STEPS = ['Pull margin USDG', 'Borrow from isolated pair', 'Swap into TSLA', 'Post collateral', 'Position live'];

function TakeVisual({ active }: { active: boolean }) {
  const [done, setDone] = useState(TX_STEPS.length);
  useEffect(() => {
    if (!active) return;
    setDone(0);
    const id = window.setInterval(() => setDone((d) => (d >= TX_STEPS.length ? 0 : d + 1)), 700);
    return () => window.clearInterval(id);
  }, [active]);
  return (
    <ol className="hunt-tx">
      {TX_STEPS.map((s, i) => (
        <li key={s} data-done={i < done || undefined}>
          <span className="hunt-tx-dot">{i < done ? <Check size={12} /> : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

const STEPS = [
  {
    n: '01',
    title: 'Observe',
    line: 'Read the tape.',
    body: 'Stock reference prices flow from the Robinhood feed into an onchain oracle with a freshness guard. Every quote a position touches is timestamped and bounded.',
    specs: ['Robinhood reference feed', 'Staleness-checked reads'],
  },
  {
    n: '02',
    title: 'Aim',
    line: 'Pick your line.',
    body: 'Choose a direction and size. Longs multiply exposure with borrowed USDG; shorts borrow the stock and sell it. Entry LTV and the liquidation price are on screen before you sign.',
    specs: ['1.25× · 1.5× long', '1.0× · 1.25× short'],
  },
  {
    n: '03',
    title: 'Take position',
    line: 'Commit in one transaction.',
    body: 'The router borrows, swaps and posts collateral atomically inside an isolated pair. Auto-Protect watches health and trims exposure before a liquidation line is reached.',
    specs: ['Atomic router call', 'Keeper-driven Auto-Protect'],
  },
];

/** Observe, aim, take position: the hunter's sequence mapped onto the product, each step with a working instrument. */
export function Hunt() {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.3 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="how-it-works" className="landing-section" aria-labelledby="hunt-title">
      <header className="section-head section-head-split">
        <span className="kicker">The hunt</span>
        <h2 id="hunt-title" className="display-lg">
          Observe. Aim. <span className="hl">Take position.</span>
        </h2>
        <p className="section-lede">
          A hunter reads the sky before the shot. ORIONMARKETS runs on the same sequence: clean prices, a defined line,
          a single committed transaction.
        </p>
        <dl className="head-specs">
          <div>
            <dt>Price source</dt>
            <dd>Robinhood stock reference</dd>
          </div>
          <div>
            <dt>Oracle guard</dt>
            <dd>Max age · spread bound</dd>
          </div>
          <div>
            <dt>Execution</dt>
            <dd>1 transaction · atomic</dd>
          </div>
          <div>
            <dt>Protection</dt>
            <dd>Auto-Protect keeper</dd>
          </div>
        </dl>
      </header>
      <div className="hunt-grid">
        {STEPS.map((s, i) => (
          <article key={s.n} className="hunt-card fx-card">
            <Constellation seed={s.title} className="hunt-stars" stars={6} dense={30} />
            <div className="hunt-card-head">
              <span className="hunt-n">{s.n}</span>
              <h3>{s.title}</h3>
            </div>
            <p className="hunt-line">{s.line}</p>
            <div className="hunt-visual">{i === 0 ? <ObserveVisual /> : i === 1 ? <AimVisual /> : <TakeVisual active={seen} />}</div>
            <p className="hunt-body">{s.body}</p>
            <ul className="spec-list">
              {s.specs.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
