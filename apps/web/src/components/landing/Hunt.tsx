'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useReferencePrices } from '../../hooks/useReferencePrices';
import { AUTOPROTECT_LIVE, AUTOPROTECT_VISIBLE } from '../../lib/release';
import { assetCatalog } from '../../lib/asset-catalog';
import { entryLtv, liquidationRatio, LEVERAGES, LIQ_LTV } from '../../lib/position-math';

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
  const [lev, setLev] = useState(LEVERAGES.long[LEVERAGES.long.length - 1]);
  const ltv = entryLtv('long', lev) * 100;
  const move = (1 - liquidationRatio('long', lev)) * 100;
  return (
    <div className="hunt-aim">
      <div className="hunt-aim-chips" role="radiogroup" aria-label="Long leverage">
        {LEVERAGES.long.map((x) => (
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

const TONES = ['lime', 'blue', 'mist'];

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
    specs: [`${LEVERAGES.long.join('× · ')}× long`, `${LEVERAGES.short.join('× · ')}× short`],
  },
  {
    n: '03',
    title: 'Take position',
    line: 'Commit in one transaction.',
    body: 'The router borrows, swaps and posts collateral atomically inside an isolated pair.' + (AUTOPROTECT_VISIBLE && AUTOPROTECT_LIVE ? ' Auto-Protect watches health and trims exposure before a liquidation line is reached.' : ''),
    specs: ['Atomic router call', AUTOPROTECT_VISIBLE && AUTOPROTECT_LIVE ? 'Keeper-driven Auto-Protect' : 'Isolated pair per equity'],
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
    <section ref={ref} id="how-it-works" className="sf-section" aria-labelledby="hunt-title">
      <header className="sf-intro">
        <span className="sf-eyebrow">The hunt</span>
        <h2 id="hunt-title" className="display-lg">
          Observe. Aim. <span className="hl">Take position.</span>
        </h2>
        <p className="section-lede">
          A hunter reads the sky before the shot. ORIONMARKETS runs on the same sequence: clean prices, a defined line,
          a single committed transaction.
        </p>
      </header>
      <div className="sf-rows">
        {STEPS.map((s, i) => (
          <div key={s.n} className="sf-split" data-flip={i % 2 === 1 || undefined}>
            <div className={`sf-card sf-visual sf-tone-${TONES[i]}`}>
              <div className="sf-device theme-inverse">
                {i === 0 ? <ObserveVisual /> : i === 1 ? <AimVisual /> : <TakeVisual active={seen} />}
              </div>
            </div>
            <article className="sf-card sf-copy theme-light">
              <span className="sf-eyebrow">
                {s.n} · {s.line}
              </span>
              <h3 className="sf-title">{s.title}</h3>
              <p>{s.body}</p>
              <ul className="spec-list">
                {s.specs.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}
