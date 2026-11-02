'use client';

import { useEffect } from 'react';

/** Everything that carries the glass flare also takes the click ripple (see "Round 2" in globals.css). */
const FX_SELECTOR = '.btn-silver, .btn-action, .btn-ghost, .landing-btn, .app-button, .launch, .fx-flare';

/**
 * One document-level listener: on pointer down it records where the press landed, so the CSS ripple grows from that
 * point. Mounted once in the root layout. Disabled controls are skipped; reduced motion hides the ripple in CSS.
 */
export function ButtonFx() {
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(FX_SELECTOR) : null;
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--rx', `${event.clientX - rect.left}px`);
      target.style.setProperty('--ry', `${event.clientY - rect.top}px`);
      // Restart the animation when the same control is pressed twice in a row.
      target.removeAttribute('data-ripple');
      void target.offsetWidth;
      target.setAttribute('data-ripple', '');
      window.setTimeout(() => target.removeAttribute('data-ripple'), 700);
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  return null;
}
