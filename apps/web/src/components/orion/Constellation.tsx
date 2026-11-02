'use client';

import { useEffect, useRef } from 'react';

/**
 * A small star chart drawn on a 2D canvas: a seeded constellation (the seed is a page name, so every page keeps its own
 * figure), linked by hairlines, twinkling, and brightening near the pointer. Decorative; pauses off screen and with
 * reduced motion.
 */
export function Constellation({ seed, className = '', stars = 9, dense = 70 }: { seed: string; className?: string; stars?: number; dense?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };

    // Figure stars sit on a loose walk across the box; dust fills the rest.
    const figure = Array.from({ length: stars }, (_, i) => ({
      x: 0.12 + (0.76 * (i + rand() * 0.8)) / stars,
      y: 0.2 + rand() * 0.6,
      r: 1.4 + rand() * 1.8,
      t: rand() * Math.PI * 2,
    }));
    const dust = Array.from({ length: dense }, () => ({ x: rand(), y: rand(), r: 0.4 + rand() * 0.8, t: rand() * 6.3 }));
    const links: Array<[number, number]> = figure.slice(1).map((_, i) => [i, i + 1]);
    for (let i = 0; i + 3 < stars; i += 3) links.push([i, i + 3]);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let hgt = 0;
    let px = -1;
    let py = -1;
    let frame = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      hgt = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, hgt * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      const style = getComputedStyle(canvas);
      const lime = style.getPropertyValue('--lime').trim() || '#b0e135';
      const blue = style.getPropertyValue('--blue').trim() || '#4178ff';
      const ink = style.getPropertyValue('--text').trim() || '#eef2e8';
      ctx.clearRect(0, 0, w, hgt);
      const s = time * 0.001;

      ctx.fillStyle = ink;
      for (const d of dust) {
        ctx.globalAlpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(s * 1.3 + d.t));
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * hgt, d.r, 0, 6.283);
        ctx.fill();
      }

      const pts = figure.map((p) => {
        const x = p.x * w + Math.sin(s * 0.4 + p.t) * 3;
        const y = p.y * hgt + Math.cos(s * 0.35 + p.t) * 3;
        const near = px < 0 ? 0 : Math.max(0, 1 - Math.hypot(x - px, y - py) / 140);
        return { x, y, r: p.r + near * 2.2, near, t: p.t };
      });

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, lime);
      grad.addColorStop(1, blue);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      for (const [a, b] of links) {
        ctx.globalAlpha = 0.28 + 0.5 * Math.max(pts[a].near, pts[b].near);
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
      }
      for (const [i, p] of pts.entries()) {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(s * 2 + p.t);
        ctx.fillStyle = i % 4 === 3 ? blue : lime;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8 + p.near * 14;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const loop = (time: number) => {
      draw(time);
      if (!reduce && visible) frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    };
    const onLeave = () => {
      px = -1;
      py = -1;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) frame = requestAnimationFrame(loop);
    });
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });

    resize();
    draw(0);
    ro.observe(canvas);
    io.observe(canvas);
    const host = canvas.parentElement ?? canvas;
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, [seed, stars, dense]);

  return <canvas ref={ref} className={`constellation ${className}`} aria-hidden="true" />;
}
