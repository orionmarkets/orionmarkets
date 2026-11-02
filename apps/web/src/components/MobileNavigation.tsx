"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { APP_NAV_LINKS } from "./navigation";
import { NetworkBadge } from "./NetworkBadge";
import { CaChip } from "./CaChip";

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectWallet?: () => void;
  isConnected?: boolean;
  formattedAddress?: string;
}

export function MobileNavigation({
  isOpen,
  onClose,
  onConnectWallet,
  isConnected,
  formattedAddress,
}: MobileNavigationProps) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (!isOpen) return null;

  const links = isLanding ? [] : APP_NAV_LINKS;

  return (
    <nav
      id="mobile-nav"
      className="mobile-nav flex flex-col fixed left-0 right-0 overflow-y-auto overscroll-contain bg-page border-b border-line px-6 py-4 z-40"
      style={{ top: "var(--header-h)", maxHeight: "calc(100dvh - var(--header-h))" }}
      aria-label="Mobile navigation"
    >
      {links.map((link) => {
        const isActive = !isLanding && pathname === link.href;
        return (
          <Link
            key={link.name}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onClose}
            className={`py-3.5 text-left border-b border-line text-[15px] ${
              isActive ? "text-ink font-medium" : "text-muted hover:text-ink"
            }`}
          >
            {link.name}
          </Link>
        );
      })}

      <div className="flex flex-wrap items-center gap-3 py-4 border-b border-line">
        <NetworkBadge />
        {isLanding && <CaChip />}
      </div>

      {isLanding && (
        <Link
          href="/markets"
          onClick={onClose}
          className="btn-action mt-5 w-full justify-center"
        >
          Open App
        </Link>
      )}

      {onConnectWallet && (
        <div className="pt-4 pb-2">
          <button
            onClick={() => {
              onClose();
              onConnectWallet();
            }}
            className="btn-action w-full justify-center"
          >
            {isConnected && formattedAddress ? formattedAddress : "Connect wallet"}
          </button>
        </div>
      )}
    </nav>
  );
}
