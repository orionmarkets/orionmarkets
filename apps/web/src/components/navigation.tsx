import React from 'react';
import { OrionMark } from './orion/OrionMark';
import { PONS_VISIBLE } from '../lib/pons-visible';
import { EARN_VISIBLE } from '../lib/earn-visible';
import { CHINA_VISIBLE } from '../lib/china-visible';

// The landing header carries no page links; the app header shows every area.
export const APP_NAV_LINKS = [
    { name: 'Markets', href: '/markets' },
    { name: 'China Equities', href: '/markets/china' },
    { name: 'Pons', href: '/markets/pons' },
    { name: 'Lending', href: '/lending' },
    { name: 'Trade', href: '/trade' },
    { name: 'Earn', href: '/earn' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Analytics', href: '/analytics' },
].filter(
    (link) =>
        (PONS_VISIBLE || link.href !== '/markets/pons') &&
        (EARN_VISIBLE || link.href !== '/earn') &&
        (CHINA_VISIBLE || link.href !== '/markets/china'),
);

/** The ORIONMARKETS mark (three slanted bars). */
export function BrandMark({ size = 32 }: { size?: number }) {
    return <OrionMark size={size} className="brand-mark" />;
}

/** The wordmark: ORION in text colour, MARKETS in the accent. */
export function Wordmark() {
    return (
        <span className="brand-name">
            ORION<b>MARKETS</b>
        </span>
    );
}
