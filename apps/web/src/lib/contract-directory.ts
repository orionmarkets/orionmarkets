import { env } from "../env.mjs";
import type { ProtocolAddresses } from "../contracts/addresses";
import { marketDeployments } from "./market-deployments";
import { AUTOPROTECT_VISIBLE, marketVisible, releaseAtLeast } from "./release";

export interface ContractEntry {
  name: string;
  address: string;
}

export interface ContractGroup {
  id: string;
  title: string;
  /** One line under the title that says what the group is for. */
  note: string;
  contracts: ContractEntry[];
}

type PonsDeployment = {
  manager: string;
  vault: string;
  oracle: string;
  markets: Record<string, string>;
};

/** Blockscout page for an address on the network this build serves. */
export function explorerAddressUrl(address: string): string {
  return `${env.EXPLORER_URL.replace(/\/$/, "")}/address/${address}`;
}

/**
 * Every contract the app reads from or sends transactions to on this network, grouped for the landing page. Built from
 * the same deployment configuration the app runs on (PROTOCOL_ADDRESSES, MARKET_DEPLOYMENTS_JSON, PONS_DEPLOYMENT_JSON),
 * so the list always matches the network of the build. An address appears once, under its first group; empty groups
 * are left out.
 */
export function buildContractDirectory(): ContractGroup[] {
  const protocol = env.PROTOCOL_ADDRESSES as ProtocolAddresses;
  const pons = env.PONS_DEPLOYMENT_JSON as PonsDeployment | null;
  const seen = new Set<string>();
  const pick = (entries: Array<[string, string | undefined]>): ContractEntry[] =>
    entries.flatMap(([name, address]) => {
      if (!address) return [];
      const key = address.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ name, address }];
    });

  const groups: ContractGroup[] = [
    {
      id: "core",
      title: "Core protocol",
      note: "Routers, registry, oracle, vault and the USDG stablecoin shared by every market.",
      contracts: pick([
        ["USDG stablecoin", env.USDG_ADDRESS],
        ["Market registry", protocol.registry],
        ["Price oracle", protocol.oracle],
        ["Orion router", protocol.orionRouter],
        ["Leverage router", protocol.leverageRouter],
        ["Short router", protocol.shortRouter],
        ["Auto-Protect module", AUTOPROTECT_VISIBLE ? protocol.autoProtect : undefined],
        ["Orion vault (ERC-4626)", protocol.orionVault],
        ["Swap pool factory", marketDeployments[0]?.margin.factory],
      ]),
    },
  ];

  // One group per listed stock, in the order of the deployment list, then any token that only has a pair.
  const symbols = [
    ...new Set([
      ...marketDeployments.map((row) => row.symbol),
      ...Object.keys(protocol.tokens),
      ...Object.keys(protocol.pairs),
    ]),
  ].filter(marketVisible);
  for (const symbol of symbols) {
    const row = marketDeployments.find((r) => r.symbol === symbol);
    groups.push({
      id: `market-${symbol.toLowerCase()}`,
      title: `${symbol} market`,
      note: `The ${symbol} stock token and the isolated contracts of its market.`,
      contracts: pick([
        [`${symbol} token`, protocol.tokens[symbol] ?? row?.long.collateral],
        ["Long pair", protocol.pairs[symbol] ?? row?.long.pair],
        ["Short pair", row?.margin.short.pair],
        ["Margin router", row?.margin.router],
        ["Swap pool", row?.margin.pool],
        ["Market oracle", row?.long.oracle],
      ]),
    });
  }

  if (pons && releaseAtLeast(3)) {
    groups.push({
      id: "pons",
      title: "Pons",
      note: "Leverage for tokens that graduated from the Pons bonding curve.",
      contracts: pick([
        ["Pons manager", pons.manager],
        ["Pons LP vault", pons.vault],
        ["Pons oracle", pons.oracle],
        ...Object.entries(pons.markets).map(
          ([symbol, address]) => [`${symbol} token`, address] as [string, string],
        ),
      ]),
    });
  }

  return groups.filter((group) => group.contracts.length > 0);
}
