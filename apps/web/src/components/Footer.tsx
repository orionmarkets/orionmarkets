'use client';

import React from 'react';
import Link from 'next/link';

import { X_URL, X_LABEL, X_TITLE, HAS_X } from '../lib/social';
import { BrandMark, Wordmark } from './navigation';
import { CaChip } from './CaChip';
import { PONS_VISIBLE } from '../lib/pons-visible';
import { EARN_VISIBLE } from '../lib/earn-visible';
import { CHINA_VISIBLE } from '../lib/china-visible';

const COLUMNS: Array<{ label: string; links: Array<{ name: string; href: string }> }> = [
    {
        label: 'Learn',
        links: [
            { name: 'Docs', href: '/docs' },
            { name: 'Features', href: '/#features' },
            { name: 'How it works', href: '/#how-it-works' },
            { name: 'Smart contracts', href: '/contracts' },
            { name: 'FAQ', href: '/faq' },
        ],
    },
    {
        label: 'Participate',
        links: [
            { name: 'Markets', href: '/markets' },
            { name: 'Lending', href: '/lending' },
            { name: 'Trade', href: '/trade' },
            { name: 'Earn', href: '/earn' },
        ].filter((link) => EARN_VISIBLE || link.href !== '/earn'),
    },
    {
        label: 'Protocol',
        links: [
            { name: 'Portfolio', href: '/portfolio' },
            { name: 'Analytics', href: '/analytics' },
            { name: 'China equities', href: '/markets/china' },
            { name: 'Pons markets', href: '/markets/pons' },
        ].filter(
            (link) =>
                (PONS_VISIBLE || link.href !== '/markets/pons') && (CHINA_VISIBLE || link.href !== '/markets/china'),
        ),
    },
];

/** Dark in both themes. */
export function Footer() {
    const scrollToTop = (e: React.MouseEvent) => {
        e.preventDefault();
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <footer className="site-footer theme-inverse">
            <div className="site-footer-inner">
                <div className="site-footer-top">
                    <div className="site-footer-brand">
                        <Link href="/" className="brand" aria-label="ORIONMARKETS home">
                            <BrandMark size={32} />
                            <Wordmark />
                        </Link>
                        <p>
                            Tokenized equities at the core. Leverage and credit around them. Built on Robinhood
                            Chain for traders who find their edge.
                        </p>
                        <CaChip className="site-footer-ca" full />
                    </div>

                    <div className="site-footer-links">
                        {COLUMNS.map((column) => (
                            <div className="site-footer-group" key={column.label}>
                                <span className="site-footer-label">{column.label}</span>
                                <nav aria-label={column.label}>
                                    {column.links.map((link) => (
                                        <Link key={link.name} href={link.href}>
                                            {link.name}
                                        </Link>
                                    ))}
                                </nav>
                            </div>
                        ))}

                        {HAS_X && (
                            <div className="site-footer-group">
                                <span className="site-footer-label">Community</span>
                                <nav aria-label="Community">
                                    <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label={X_LABEL} title={X_TITLE}>
                                        X
                                    </a>
                                </nav>
                            </div>
                        )}
                    </div>
                </div>

                <div className="site-footer-bottom">
                    <div className="site-footer-legal">
                        <span>© 2026 ORIONMARKETS</span>
                        <a href="#main" onClick={scrollToTop}>
                            Back to top ↑
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
