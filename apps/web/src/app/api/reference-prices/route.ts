import { NextRequest, NextResponse } from 'next/server';
import environment from '../../../../config/environment.cjs';
import { env } from '../../../env.mjs';
import { assetCatalog } from '../../../lib/asset-catalog';
import mainnetConfig from '../../../../../../scripts/mainnet-full-deploy.config.json';
import { readReferencePrices } from '../../../lib/read-reference-prices';
import { readPythReferencePrices } from '../../../lib/read-pyth-reference-prices';
import type { ReferencePrices } from '../../../lib/reference-prices';
import {
    fetchRobinhoodJson,
    parseRobinhoodTransport,
} from '../../../../../price-oracle/src/services/robinhoodTransport';
export const dynamic = 'force-dynamic';
// Underlying-stock quotes for display. Testnet lists only TSLA as a token, so every catalog ticker is identified by its
// Robinhood Chain mainnet token (same stock, same Robinhood reference); this network's own tokens take precedence.
function referenceIdentities() {
    const mainnet = new Map(mainnetConfig.markets.map((m) => [m.symbol, m.token]));
    return assetCatalog.flatMap((x) => {
        const own = env.PROTOCOL_ADDRESSES.tokens[x.ticker];
        if (own) return [{ symbol: x.ticker, chainId: env.CHAIN_ID, address: own }];
        const token = mainnet.get(x.ticker);
        return token ? [{ symbol: x.ticker, chainId: 4663, address: token }] : [];
    });
}
let cache: { at: number; data: ReferencePrices } | null = null;
let inFlight: Promise<ReferencePrices> | null = null;
export async function GET(request: NextRequest) {
    const server = environment.validate(environment.serverSchema, process.env);
    const robinhoodTransport = parseRobinhoodTransport(
        server.ROBINHOOD_TRANSPORT_JSON,
    );
    const headers = { 'cache-control': 'no-store' };
    if (request.nextUrl.searchParams.size)
        return NextResponse.json(
            { error: 'Only configured stock references are available.' },
            { status: 400, headers },
        );
    try {
        if (
            cache &&
            Date.now() - cache.at < server.REFERENCE_PRICE_POLICY_JSON.cacheMs
        )
            return NextResponse.json(cache.data, { headers });
        if (!inFlight) {
            inFlight = (
                server.REFERENCE_PRICE_PROVIDER === 'PYTH'
                    ? readPythReferencePrices(
                          server.PYTH_HERMES_URL,
                          server.PYTH_API_KEY,
                          server.PYTH_FEEDS_JSON,
                          {
                              ...server.REFERENCE_PRICE_POLICY_JSON,
                              maxConfidenceBps: server.PYTH_MAX_CONFIDENCE_BPS,
                              batchSize: server.PYTH_REQUEST_BATCH_SIZE,
                          },
                      )
                    : readReferencePrices(
                          server.ROBINHOOD_STOCK_API_URL,
                          referenceIdentities(),
                          server.REFERENCE_PRICE_POLICY_JSON,
                          (url, policy) =>
                              fetchRobinhoodJson(
                                  url,
                                  policy,
                                  robinhoodTransport,
                              ),
                      )
            )
                .then((data) => {
                    cache = { at: Date.now(), data };
                    return data;
                })
                .finally(() => {
                    inFlight = null;
                });
        }
        return NextResponse.json(await inFlight, { headers });
    } catch {
        return NextResponse.json(
            { error: 'Stock reference service unavailable.' },
            { status: 503, headers },
        );
    }
}
