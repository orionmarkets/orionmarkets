'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { WalletModal } from './WalletModal';
import { MobileNavigation } from './MobileNavigation';
import { ThemeToggle } from './ThemeToggle';
import { APP_NAV_LINKS, BrandMark, Wordmark } from './navigation';
import { NetworkBadge } from './NetworkBadge';
import { CaChip } from './CaChip';
import { HAS_X, X_URL, X_LABEL, X_TITLE } from '../lib/social';

export function Header() {
    const pathname = usePathname();
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { address, isConnected } = useAccount();
    const formattedAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : undefined;

    const isLanding = pathname === '/';

    // A hairline appears under the header once the page has moved.
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close the drawer when the route changes.
    useEffect(() => {
        setIsMobileNavOpen(false);
    }, [pathname]);

    return (
        <>
            <a className="skip" href="#main">
                Skip to content
            </a>

            <header
                className="site-header"
                data-variant={isLanding ? 'landing' : 'app'}
                data-scrolled={scrolled || !isLanding ? 'true' : 'false'}
            >
                <div className="site-header-inner">
                    <Link href="/" className="brand" aria-label="ORIONMARKETS home" data-nav-item="">
                        <BrandMark />
                        <Wordmark />
                    </Link>

                    {isLanding ? (
                        <CaChip className="site-ca" fullOnWide />
                    ) : (
                        <nav className="site-nav" aria-label="Main navigation">
                            {APP_NAV_LINKS.map((link) => {
                                const isActive =
                                    pathname === link.href ||
                                    (link.href !== '/markets' && pathname.startsWith(`${link.href}/`)) ||
                                    (link.href === '/markets' &&
                                        pathname.startsWith('/markets/') &&
                                        !pathname.startsWith('/markets/china') &&
                                        !pathname.startsWith('/markets/pons'));
                                return (
                                    <Link
                                        key={link.name}
                                        href={link.href}
                                        aria-current={isActive ? 'page' : undefined}
                                        data-nav-item=""
                                        className="nav-link"
                                    >
                                        {link.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    )}

                    <div className="site-actions">
                        <NetworkBadge className="site-net" />

                        {HAS_X && (
                            <a
                                href={X_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="icon-btn"
                                data-nav-item=""
                                aria-label={X_LABEL}
                                title={X_TITLE}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                        )}

                        {isLanding && (
                            <Link href="/markets" className="btn-action btn-action-sm" data-nav-item="">
                                Open App
                            </Link>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsWalletModalOpen(true)}
                            className="btn-action btn-action-sm"
                            data-nav-item=""
                        >
                            {isConnected && formattedAddress ? formattedAddress : 'Connect wallet'}
                        </button>

                        <ThemeToggle />

                        <button
                            type="button"
                            className="mobile-menu"
                            data-nav-item=""
                            aria-label="Open navigation"
                            aria-expanded={isMobileNavOpen}
                            aria-controls="mobile-nav"
                            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                        >
                            Menu <span>{isMobileNavOpen ? '−' : '+'}</span>
                        </button>
                    </div>
                </div>
            </header>

            <MobileNavigation
                isOpen={isMobileNavOpen}
                onClose={() => setIsMobileNavOpen(false)}
                onConnectWallet={() => setIsWalletModalOpen(true)}
                isConnected={isConnected}
                formattedAddress={formattedAddress}
            />

            <WalletModal
                isOpen={isWalletModalOpen}
                onClose={() => setIsWalletModalOpen(false)}
            />
        </>
    );
}
