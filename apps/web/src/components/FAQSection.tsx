"use client";

import React from "react";

import { X_URL, HAS_X } from "../lib/social";
import { useNetworkMode } from "../hooks/useNetworkMode";
import { marketDeployments } from "../lib/market-deployments";
import { AUTOPROTECT_LIVE, liveMarketList } from "../lib/release";
const LIVE_MARKETS = liveMarketList(marketDeployments.map((m) => m.symbol));
const MAINNET_ANSWERS: Record<string, string> = {
  "How does borrowing work?":
    `Deposit collateral into an enabled lending market, then borrow USDG within its LTV limits. ${LIVE_MARKETS} markets are live on Robinhood Chain mainnet, each with its own isolated pair and onchain price feed.`,
  "Can I trade right now?":
    `Yes. Lending and Long/Short are live on ${LIVE_MARKETS} on Robinhood Chain mainnet. Want to practice first? Switch to testnet from the header. More markets, Earn vaults and Auto-Protect are on the Orion roadmap, and the team keeps shipping.`,
};
const FAQ_ITEMS = [
  {
    question: "What is ORIONMARKETS?",
    answer:
      "ORIONMARKETS is a trading and credit stack for tokenized equities on Robinhood Chain. Go long or short tokenized stocks with leverage, or post them as collateral and borrow USDG. Every market runs in its own isolated pair.",
  },
  {
    question: "Why “Orion”?",
    answer:
      "Orion is the hunter of the night sky, the constellation navigators have steered by for millennia. The name carries the sequence the product is built around: observe the market, choose a direction, take a position. The stars give you the map; your conviction takes the shot.",
  },
  {
    question: "How does borrowing work?",
    answer:
      "Deposit collateral into an enabled lending market, then borrow USDG within its LTV limits. The market needs a fresh oracle price and available liquidity. Each market is a separate pair, so risk never pools across assets.",
  },
  {
    question: "What is Auto-Protect?",
    answer:
      AUTOPROTECT_LIVE
        ? "Auto-Protect repays part of your debt from your own wallet's USDG when your loan ratio reaches a trigger you set, until a target ratio is restored. You approve the amount; it does not sell collateral and does nothing if your balance or approval is short."
        : "Auto-Protect is the planned protection layer for leveraged positions: it partially deleverages a position as it nears a risk threshold you define. It is part of the Orion roadmap and rolls out on Robinhood Chain as it is ready.",
  },
  {
    question: "How does leverage work?",
    answer:
      "Leverage amplifies results in both directions. You pick the loan ratio, and isolated markets keep each asset’s risk inside its own pair.",
  },
  {
    question: "Can I trade right now?",
    answer:
      "Lending and Long/Short are available market by market once a market’s price feed, liquidity and launch checks pass. Earn and Auto-Protect open as each is verified. Markets that are not open yet are shown as paused.",
  },
];

export function FAQSection() {
  const { isTestnet } = useNetworkMode();
  return (
    <section className="faq-section section-wrap" id="faq">
      <div>
        <div className="section-topline">
          <span>§ 10 / THE DETAILS</span>
        </div>
        <h2 className="section-title">
          A little
          <br />
          <span>more clarity.</span>
        </h2>

        {HAS_X ? (
          <p className="faq-contact">
            Still have questions?{" "}
            <a href={X_URL} target="_blank" rel="noopener noreferrer">
              Reach out on X ↗
            </a>
          </p>
        ) : (
          <p className="faq-contact">Still have questions? Everything the protocol does is public on-chain.</p>
        )}
      </div>

      <div className="faq-list">
        {FAQ_ITEMS.map((item, idx) => (
          <details key={idx}>
            <summary>
              {item.question}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{(!isTestnet && MAINNET_ANSWERS[item.question]) || item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
