"use client";
import Link from "next/link";
import { env } from "../../env.mjs";
import { AppPage } from "../../components/AppPage";
import { assetCatalog, marketPath } from "../../lib/asset-catalog";
import { marketDeployments } from "../../lib/market-deployments";
import { PONS_VISIBLE } from "../../lib/pons-visible";
import { CHINA_TICKERS, CHINA_VISIBLE } from "../../lib/china-visible";

// ETFs and China ADRs in the catalog; every other ticker is a US stock.
const ETF_TICKERS = new Set(["SPY", "QQQ", "SGOV", "SLV"]);
const CHINA_SET = new Set(CHINA_TICKERS);
const CATALOG_GROUPS = [
  { id: "us", title: "US stocks", assets: assetCatalog.filter((a) => !ETF_TICKERS.has(a.ticker) && !CHINA_SET.has(a.ticker)) },
  { id: "etf", title: "ETFs", assets: assetCatalog.filter((a) => ETF_TICKERS.has(a.ticker)) },
  { id: "china", title: "China equities", assets: assetCatalog.filter((a) => CHINA_SET.has(a.ticker)) },
].filter((g) => g.assets.length > 0);

export default function MarketsPage() {
  return (
    <AppPage
      banner="candles"
      eyebrow="Market directory"
      title="Find your next market."
      description="Explore tokenized equities, compare market parameters, and choose where to put your assets to work."
    >
      {marketDeployments.some((x) => x.enabled) && (
        <section className="app-panel market-overview">
          <h2>Stock / USDG markets · Long &amp; Short</h2>
          <p className="app-note">
            Use USDG as margin on the available markets. Live prices and
            liquidity are verified before opening a position.
          </p>
          <Link className="app-button" href="/trade">
            Choose a market ↗
          </Link>
        </section>
      )}
      <p className="app-note">
        Each market needs verified contracts, fresh prices and funded liquidity
        before trading.{" "}
        <Link className="text-action" href="/analytics">
          View verified onchain liquidity ↗
        </Link>
      </p>
      <div className="app-section-label">
        <span>01 / Market directory</span>
      </div>
      <section className="catalog-section" aria-labelledby="catalog-title">
        <div className="app-section-label">
          <h2 id="catalog-title">Explore the assets.</h2>
          <span>{assetCatalog.length} target markets · availability below</span>
        </div>
        {CATALOG_GROUPS.map((group) => (
          <div key={group.id} className="catalog-group">
            <h3 className="catalog-group-title">
              {group.title} <span>{group.assets.length}</span>
            </h3>
            <div className="asset-directory">
              {group.assets.map((asset) => (
                <Link
                  className="directory-card"
                  href={marketPath(asset.ticker)}
                  key={asset.ticker}
                >
                  <img src={asset.image} alt="" />
                  <div>
                    <strong>{asset.ticker}</strong>
                    <span>{asset.name}</span>
                    <small className="directory-readiness">
                      {marketDeployments.some((x) => x.symbol === asset.ticker)
                        ? "Contracts configured · live checks required"
                        : env.PROTOCOL_ADDRESSES.tokens[asset.ticker]
                          ? "Token configured · contracts pending"
                          : "Token verification pending"}
                    </small>
                  </div>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
      {PONS_VISIBLE && (
        <section className="app-panel fx-card pons-crosslink" style={{ marginTop: 32 }}>
          <div className="app-section-label">
            <span>02 / Pons graduated assets</span>
          </div>
          <h2>Pons Markets</h2>
          <p className="app-note">
            Tokens that graduate from Pons bonding curves become candidates for
            leverage trading. Discover eligible assets and their market parameters.
          </p>
          <Link className="app-button secondary" href="/markets/pons">
            Explore Pons markets ↗
          </Link>
        </section>
      )}
      {CHINA_VISIBLE && (
        <section className="app-panel fx-card china-crosslink" style={{ marginTop: 24 }}>
          <div className="app-section-label">
            <span>03 / Chinese Equities · Robinhood Chain</span>
          </div>
          <h2>Tokenized Chinese Equities</h2>
          <p className="app-note">
            Tokenized exposure to Chinese companies through US-listed ADRs on Robinhood Chain, with isolated USDG lending and long and short margin.
          </p>
          <Link className="app-button" href="/markets/china">
            Explore China Markets ↗
          </Link>
        </section>
      )}
    </AppPage>
  );
}
