import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MaxLeverage, NetworkStatus } from "../../components/docs/NetworkText";
import { PONS_VISIBLE } from "../../lib/pons-visible";
import { EARN_VISIBLE } from "../../lib/earn-visible";
import { CHINA_VISIBLE } from "../../lib/china-visible";

export const metadata: Metadata = {
  title: "Docs",
  description: "How ORIONMARKETS works: isolated markets, Lending, Trade and the roadmap.",
};

// Every sentence here restates copy the site already shows (landing, FAQ, page headers). Nothing is added that the
// product does not already say about itself.
const ALL_SECTIONS = [
  { id: "overview", title: "Overview" },
  { id: "how-it-works", title: "How it works" },
  { id: "markets", title: "Markets" },
  { id: "earn", title: "Earn" },
  { id: "lending", title: "Lending" },
  { id: "trade", title: "Trade" },
  { id: "auto-protect", title: "Roadmap" },
  { id: "risks", title: "Leverage" },
  { id: "status", title: "Status" },
];
const SECTIONS = ALL_SECTIONS.filter((section) => EARN_VISIBLE || section.id !== "earn");

export default function DocsPage() {
  return (
    <div className="docs">
      <header className="docs-head">
        <p className="landing-label">Docs</p>
        <h1 className="landing-h2">ORIONMARKETS documentation</h1>
        <p className="landing-body">
          What the protocol is, what each part does, and how to get started.
        </p>
      </header>

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="On this page">
          <span className="docs-toc-label">On this page</span>
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>

        <article className="docs-body">
          <section id="overview">
            <h2>Overview</h2>
            <p>
              ORIONMARKETS is a trading and credit stack for tokenized equities on Robinhood Chain. Tokenized stocks sit
              at the core; leveraged long and short positions and USDG credit are built around them.
            </p>
            <p>
              The name comes from the hunter constellation and the sequence it stands for: observe, aim, take position.
              Prices come from a freshness-guarded reference oracle, every position is sized and priced before you sign,
              and each one settles in a single transaction inside its own isolated pair.
            </p>
            <h3>Isolated by design</h3>
            <p>
              Every lending pair is its own sealed room. When one asset has a bad day, the damage stays in that room.
              There is no shared pool for it to travel through.
            </p>
            <h3>Rules you can read</h3>
            <p>
              Borrowers pay for credit and choose their own loan ratio. Every pair has clear rules, so the individually
              rational move is also the one that keeps the market healthy.
            </p>
            <h3>Direction, sized</h3>
            <p>
              Open a long up to <MaxLeverage /> or a short on tokenized stocks and ETFs in a single transaction. Choose the loan
              ratio that suits you.
            </p>
          </section>

          <section id="how-it-works">
            <h2>How it works</h2>
            <ol>
              <li>
                <strong>Deposit.</strong> Deposit tokenized stocks as collateral into an isolated market.
              </li>
              <li>
                <strong>Borrow or trade.</strong> Deposit collateral and borrow USDG within a market’s loan ratio, or go
                long or short in a single transaction.
              </li>
              <li>
                <strong>Stay in control.</strong> Pick the loan ratio that suits you and follow your health factor.
                Add collateral or repay at any time.
              </li>
              <li>
                <strong>Repay and withdraw.</strong> Repay your debt and withdraw your collateral whenever you like.
              </li>
            </ol>
          </section>

          <section id="markets">
            <h2>Markets</h2>
            <p>
              Each market is a separate pair, so risk never pools across assets. A market needs a fresh oracle price and
              available liquidity before it takes new exposure; stale prices or paused markets block it.
            </p>
            <p>
              Explore tokenized equities, compare market parameters, and choose where to put your assets to work in the{" "}
              <Link href="/markets">market directory</Link>.
            </p>
            {CHINA_VISIBLE && (
              <>
                <h3>Chinese equities</h3>
                <p>
                  Tokenized exposure to Chinese companies through US-listed ADRs on Robinhood Chain, with isolated USDG
                  lending and long and short margin. See{" "}
                  <Link href="/markets/china">Chinese equities</Link>.
                </p>
              </>
            )}
            {PONS_VISIBLE && (
              <>
                <h3>Pons</h3>
                <p>
                  Tokens that completed the Pons bonding curve and meet liquidity, market cap, and oracle requirements for
                  leverage trading. See <Link href="/markets/pons">Pons markets</Link>.
                </p>
              </>
            )}
          </section>

          {EARN_VISIBLE && (
            <section id="earn">
              <h2>Earn</h2>
              <p>
                Supply stablecoins to ERC-4626 vaults and earn from borrowers across isolated markets. Review each
                vault’s allocation, utilization, and withdrawal conditions before you deposit. Risk you can size, one
                market at a time. Browse the <Link href="/earn">vaults</Link>.
              </p>
            </section>
          )}

          <section id="lending">
            <h2>Lending</h2>
            <p>
              Deposit collateral into an enabled lending market, then borrow USDG within its LTV limits. The market needs
              a fresh oracle price and available liquidity. Manage repayment and withdrawals from the same page. Start in{" "}
              <Link href="/lending">Lending</Link>.
            </p>
          </section>

          <section id="trade">
            <h2>Trade</h2>
            <p>
              Go long or short tokenized stocks in a single transaction, with a loan ratio you choose. Longs go up to <MaxLeverage /> on this deployment. Quotes include swap fees and price
              impact; stale prices or paused markets block new exposure. Open <Link href="/trade">Trade</Link>.
            </p>
          </section>

          <section id="auto-protect">
            <h2>Roadmap</h2>
            <p>
              ORIONMARKETS is actively maintained and keeps shipping. Next on the roadmap: more tokenized stock and ETF
              markets, Earn vaults for stablecoin lenders, and Auto-Protect, an automated defense that partially
              deleverages a position as it nears the threshold you set.
            </p>
          </section>

          <section id="risks">
            <h2>Leverage</h2>
            <p>
              Leverage amplifies results in both directions. You pick the loan ratio, and isolated markets keep each
              asset’s risk inside its own pair.
            </p>
          </section>

          <section id="status">
            <h2>Status</h2>
            <NetworkStatus />
            <p>
              More answers are in the <Link href="/faq">FAQ</Link>.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
