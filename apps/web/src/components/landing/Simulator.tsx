'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useReferencePrices } from '../../hooks/useReferencePrices';
import { assetCatalog, tradePath } from '../../lib/asset-catalog';
import { entryLtv, LEVERAGES, liquidationRatio, pnl, type Side } from '../../lib/position-math';

const ASSETS = assetCatalog.filter((a) => a.featured);
const W = 640;
const H = 260;
const RANGE = 0.6; // chart spans ±60% price moves
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const parsePrice = (s: string | null) => (s ? Number(s.replace(/[$,]/g, '')) : null);

/** Line up the shot: pick an equity, a side and a size; the payoff curve, liquidation line and numbers follow live. */
export function Simulator() {
  const refs = useReferencePrices();
  const [ticker, setTicker] = useState(ASSETS[0].ticker);
  const [side, setSide] = useState<Side>('long');
  const [lev, setLev] = useState(1.5);
  const [margin, setMargin] = useState(1000);
  const [hover, setHover] = useState<number | null>(null);

  const entry = parsePrice(refs.last(ticker));
  const liq = liquidationRatio(side, lev);
  const x = (p: number) => ((p - (1 - RANGE)) / (2 * RANGE)) * W;
  const y = (v: number) => H / 2 - (v / 1.2) * (H / 2 - 12);

  const path = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const p = 1 - RANGE + (2 * RANGE * i) / 120;
      pts.push(`${i ? 'L' : 'M'}${x(p).toFixed(1)} ${y(pnl(side, lev, p)).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [side, lev]);

  const hp = hover ?? (side === 'long' ? 1.2 : 0.8);
  const hv = pnl(side, lev, hp);
  const pick = (s: Side) => {
    setSide(s);
    setLev(LEVERAGES[s][LEVERAGES[s].length - 1]);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(1 - RANGE + 2 * RANGE * t);
  };

  return (
    <section id="simulator" className="landing-section" aria-labelledby="sim-title">
      <header className="section-head section-head-split">
        <span className="kicker">Position simulator</span>
        <h2 id="sim-title" className="display-lg">
          Line up <span className="hl">the shot.</span>
        </h2>
        <p className="section-lede">
          Same mechanics as the live markets: the leverage tiers, the liquidation LTVs and the reference price feed.
          Drag across the curve to read your position at any price.
        </p>
        <dl className="head-specs">
          <div>
            <dt>Long tiers</dt>
            <dd>1.25× · 1.5×</dd>
          </div>
          <div>
            <dt>Short tiers</dt>
            <dd>1.0× · 1.25×</dd>
          </div>
          <div>
            <dt>Long liquidation</dt>
            <dd>65% LTV</dd>
          </div>
          <div>
            <dt>Short liquidation</dt>
            <dd>80% LTV</dd>
          </div>
        </dl>
      </header>

      <div className="sim">
        <div className="sim-controls">
          <div className="sim-field">
            <span className="sim-label">Equity</span>
            <div className="sim-assets">
              {ASSETS.map((a) => (
                <button key={a.ticker} type="button" className="chip chip-asset" aria-pressed={ticker === a.ticker} onClick={() => setTicker(a.ticker)}>
                  <img src={a.image} alt="" />
                  {a.ticker}
                </button>
              ))}
            </div>
          </div>
          <div className="sim-field">
            <span className="sim-label">Direction</span>
            <div className="sim-side" role="radiogroup" aria-label="Direction">
              {(['long', 'short'] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={side === s} data-side={s} onClick={() => pick(s)}>
                  {s === 'long' ? 'Long ↗' : 'Short ↘'}
                </button>
              ))}
            </div>
          </div>
          <div className="sim-field">
            <span className="sim-label">{side === 'long' ? 'Leverage' : 'Short exposure'}</span>
            <div className="sim-levs">
              {LEVERAGES[side].map((l) => (
                <button key={l} type="button" className="chip" aria-pressed={lev === l} onClick={() => setLev(l)}>
                  {l.toFixed(2).replace(/0$/, '')}×
                </button>
              ))}
            </div>
          </div>
          <label className="sim-field">
            <span className="sim-label">Margin · USDG</span>
            <input
              className="sim-input num"
              type="range"
              min={100}
              max={10000}
              step={100}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
            />
            <span className="sim-margin num">{usd(margin)}</span>
          </label>

          <dl className="sim-stats">
            <div>
              <dt>Exposure</dt>
              <dd className="num">{usd(margin * lev)}</dd>
            </div>
            <div>
              <dt>{side === 'long' ? 'USDG borrowed' : 'Stock borrowed'}</dt>
              <dd className="num">{usd(margin * (side === 'long' ? lev - 1 : lev))}</dd>
            </div>
            <div>
              <dt>Entry LTV</dt>
              <dd className="num">{(entryLtv(side, lev) * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Liquidation</dt>
              <dd className="num">
                {entry ? usd(entry * liq) : ''} {side === 'long' ? '↓' : '↑'} {(Math.abs(1 - liq) * 100).toFixed(1)}%
              </dd>
            </div>
          </dl>
          <Link href={tradePath(ticker)} className="landing-btn btn-lg sim-go">
            Open {ticker} {side} <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="sim-chart">
          <div className="sim-chart-head">
            <span>
              <b>{ticker}</b> {entry ? `entry ${usd(entry)}` : 'reference feed'}
            </span>
            <span className="num" data-sign={hv >= 0 ? 'up' : 'down'}>
              {(hp >= 1 ? '↑ ' : '↓ ') + (Math.abs(hp - 1) * 100).toFixed(1)}% move · {hv >= 0 ? '+' : '−'}
              {usd(Math.abs(hv * margin))}
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="sim-svg"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={`Profit and loss of a ${lev}× ${side} across price moves of plus or minus ${RANGE * 100}%`}
          >
            <defs>
              <linearGradient id="sim-up" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--lime)" stopOpacity="0.35" />
                <stop offset="1" stopColor="var(--lime)" stopOpacity="0" />
              </linearGradient>
              <clipPath id="sim-top">
                <rect x="0" y="0" width={W} height={H / 2} />
              </clipPath>
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1={W * g} x2={W * g} y1="0" y2={H} className="sim-grid" />
            ))}
            <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="sim-zero" />
            <path d={`${path} L${W} ${H / 2} L0 ${H / 2} Z`} fill="url(#sim-up)" clipPath="url(#sim-top)" />
            <path d={path} className="sim-curve" />
            {liq > 1 - RANGE && liq < 1 + RANGE && (
              <g className="sim-liq">
                <line x1={x(liq)} x2={x(liq)} y1="0" y2={H} />
                <text x={x(liq) + (side === 'long' ? 6 : -6)} y="16" textAnchor={side === 'long' ? 'start' : 'end'}>
                  LIQ
                </text>
              </g>
            )}
            <line x1={x(1)} x2={x(1)} y1="0" y2={H} className="sim-entry" />
            <g className="sim-cursor">
              <line x1={x(hp)} x2={x(hp)} y1="0" y2={H} />
              <circle cx={x(hp)} cy={y(hv)} r="6" />
            </g>
          </svg>
          <div className="sim-axis num" aria-hidden="true">
            <span>↓ 60%</span>
            <span>↓ 30%</span>
            <span>entry</span>
            <span>↑ 30%</span>
            <span>↑ 60%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
