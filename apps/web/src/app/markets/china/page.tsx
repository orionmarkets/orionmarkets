"use client";

import Link from "next/link";
import { AppPage } from "../../../components/AppPage";
import { AssetLogo } from "../../../components/AssetLogo";
import { CHINA_TICKERS } from "../../../lib/china-visible";
import { getChineseAssetBySymbol, chineseEquitiesCatalog } from "../../../lib/chinese-equities-client";
import { explorerAddressUrl } from "../../../lib/contract-directory";
import { marketDeployments } from "../../../lib/market-deployments";
import { marketPath, tradePath } from "../../../lib/asset-catalog";

const live = marketDeployments.filter((x) => x.enabled && CHINA_TICKERS.includes(x.symbol));
// Tokens on Robinhood Chain that have no Orion market yet because they lack an onchain price feed.
const waiting = chineseEquitiesCatalog.filter(
  (a) => a.tokenAddress && a.targetChainId === 4663 && !marketDeployments.some((x) => x.symbol === a.ticker),
);

export default function ChinaMarketsPage() {
  return (
    <AppPage
      banner="pagoda"
      back
      eyebrow="China Equities · Robinhood Chain"
      title="Chinese equities, onchain."
      description="Tokenized exposure to Chinese companies through US-listed ADRs on Robinhood Chain, with isolated USDG lending and long and short margin."
    >
      <div className="app-section-label">
        <span>01 / Live markets</span>
        <span>{live.length} open</span>
      </div>
      <div className="asset-directory">
        {live.map((market) => {
          const asset = getChineseAssetBySymbol(market.symbol);
          return (
            <section className="app-panel market-overview" key={market.symbol}>
              <div className="market-identity">
                <AssetLogo symbol={market.symbol} size="lg" />
                <div>
                  <h2>{market.symbol} / USDG</h2>
                  <span>{asset?.company ?? market.symbol}</span>
                </div>
                <span className="app-badge">Live</span>
              </div>
              {asset && (
                <dl className="market-metrics">
                  {[
                    ["Instrument", asset.instrumentType],
                    ["Listing", `${asset.underlyingExchange} · ${asset.underlyingCurrency}`],
                    ["ISIN", asset.isin],
                    ["Token issuer", asset.tokenIssuer ?? "Unavailable"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd style={{ fontSize: 18 }}>{value}</dd>
                    </div>
                  ))}
                  {asset.tokenAddress && (
                    <div>
                      <dt>Token</dt>
                      <dd style={{ fontSize: 18 }}>
                        <a className="text-action" href={explorerAddressUrl(asset.tokenAddress)} target="_blank" rel="noreferrer">
                          {asset.tokenAddress.slice(0, 6)}…{asset.tokenAddress.slice(-4)} ↗
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 16 }}>
                <Link className="app-button" href={tradePath(market.symbol)}>
                  Trade {market.symbol} ↗
                </Link>
                <Link className="app-button secondary" href={`/lending?asset=${market.symbol}`}>
                  Lend and borrow ↗
                </Link>
                <Link className="text-action" href={marketPath(market.symbol)}>
                  Market details ↗
                </Link>
              </div>
            </section>
          );
        })}
      </div>
      {waiting.length > 0 && (
        <>
          <div className="app-section-label">
            <span>02 / Next</span>
          </div>
          <p className="app-note">
            These tokens already exist on Robinhood Chain. A market opens as soon as a price feed is published onchain.
          </p>
          <div className="asset-directory">
            {waiting.map((asset) => (
              <div className="directory-card" key={asset.ticker}>
                <AssetLogo symbol={asset.ticker} />
                <div>
                  <strong>{asset.ticker}</strong>
                  <span>{asset.name}</span>
                  <small className="directory-readiness">Token live · price feed pending</small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppPage>
  );
}
