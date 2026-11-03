'use client';

import React from 'react';
import { useNetworkMode } from '../../hooks/useNetworkMode';
import { MAX_LEVERAGE_LABEL } from '../../lib/leverage';
import { marketDeployments } from '../../lib/market-deployments';
import { liveMarketList } from '../../lib/release';

/** The leverage cap offered in the app, the same on mainnet and testnet. */
export function MaxLeverage() {
  return <>{MAX_LEVERAGE_LABEL}</>;
}

/** What is open on this deployment right now. The sentences are the ones the FAQ already gives. */
export function NetworkStatus() {
  const { isTestnet } = useNetworkMode();
  return (
    <p>
      {isTestnet
        ? 'Testnet mirrors the mainnet product with test funds, so you can try Lending and Long/Short on Robinhood Chain testnet before using mainnet. Markets that are not open yet are shown as paused.'
        : `Lending and Long/Short are live on Robinhood Chain mainnet for ${liveMarketList(marketDeployments.map((m) => m.symbol))}, with more markets, Earn vaults and Auto-Protect on the Orion roadmap. You can try every flow first on testnet with the switch in the header. ORIONMARKETS is actively maintained and shipping.`}
    </p>
  );
}
