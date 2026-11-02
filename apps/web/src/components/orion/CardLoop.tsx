'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useReferencePrices } from '../../hooks/useReferencePrices';
import { assetCatalog, marketPath } from '../../lib/asset-catalog';
import { MAX_LEVERAGE_LABEL as MAX_LEVERAGE } from '../../lib/leverage';

/**
 * The hero's looping 3D card ring (the original hero, carried over): one card per tokenized equity, orbiting
 * on a CSS 3D ring, nudged by the pointer. Each card opens its market. Transform-only animation, paused off screen.
 */
export function CardLoop() {
  const references = useReferencePrices();
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const assets = assetCatalog.filter((a) => a.category !== 'China');

  useEffect(() => {
    const scene = sceneRef.current;
    const cards = cardRefs.current.filter(Boolean) as HTMLAnchorElement[];
    if (!scene || cards.length === 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let phase = 0;
    let frame = 0;
    let pointerX = 0;
    let hovered = false;
    let visible = true;
    let last = performance.now();

    const draw = () => {
      const width = scene.clientWidth;
      const radius = Math.min(width * 0.36, 420);
      cards.forEach((card, i) => {
        const theta = (i / cards.length) * Math.PI * 2 + phase;
        const x = Math.sin(theta) * radius;
        const depth = Math.cos(theta);
        const y = Math.sin(theta * 2 + phase * 0.25) * 12;
        const scale = 0.74 + (depth + 1) * 0.14;
        card.style.transform = `translate3d(${x + pointerX * (depth + 1)}px, ${y}px, 0) rotateY(${Math.sin(theta) * -33}deg) rotateZ(${Math.sin(theta) * 3}deg) scale(${scale})`;
        card.style.zIndex = String(Math.round((depth + 1) * 100));
        card.style.setProperty('--depth', String((depth + 1) / 2));
      });
    };
    const loop = (now: number) => {
      // Slow down while a card is under the pointer so it can be read and clicked.
      phase += (now - last) * (hovered ? 0.00002 : 0.00013);
      last = now;
      draw();
      if (visible) frame = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      const rect = scene.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
      hovered = (e.target as Element).closest('.loop-card') !== null;
    };
    const onLeave = () => {
      pointerX = 0;
      hovered = false;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      last = performance.now();
      if (visible && !reduce) frame = requestAnimationFrame(loop);
    });

    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', draw);
    draw();
    io.observe(scene);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      scene.removeEventListener('pointermove', onMove);
      scene.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', draw);
    };
  }, [assets.length]);

  return (
    <div ref={sceneRef} className="loop-scene" aria-label="Tokenized equities on ORIONMARKETS">
      <div className="loop-stage">
        {assets.map((asset, idx) => {
          const price = references.last(asset.ticker);
          return (
            <Link
              key={asset.ticker}
              href={marketPath(asset.ticker)}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              className={`loop-card ${asset.className}`}
              aria-label={`Open the ${asset.name} market`}
            >
              <span className="loop-card-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="loop-card-top">
                <b>{asset.ticker}</b>
                <span>{asset.category === 'ETFs' ? 'ETF' : 'EQUITY'}</span>
              </span>
              <img src={asset.image} alt="" draggable={false} />
              <span className="loop-card-bottom">
                <span className="loop-card-quote">
                  {price ? <b>{price}</b> : <b className="loop-card-sync">{asset.name}</b>}
                  <small>{price ? 'Reference · USD' : 'Tokenized on Robinhood Chain'}</small>
                </span>
                <span className="loop-card-lev">
                  <small>Long · Short</small>
                  <b>{MAX_LEVERAGE}</b>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
