<p align="center"><img src="orionmarkets-logo.png" width="96" alt="ORIONMARKETS" /></p>

<h1 align="center">ORIONMARKETS</h1>
<p align="center"><strong>Find your edge.</strong></p>
<p align="center">Tokenized equities · Leveraged long/short trading · Borrowing &amp; credit — on Robinhood Chain</p>
<p align="center"><a href="https://orionmarkets.tech">orionmarkets.tech</a> · <a href="https://testnet.orionmarkets.tech">testnet</a> · <a href="https://x.com/UseOrionMarkets">@UseOrionMarkets</a></p>

---

Tokenized equities at the core. Leverage and credit around them. A new financial stack for your market conviction.

ORIONMARKETS takes its name from the hunter constellation and the sequence it stands for: **observe** the market,
**aim** a direction and size, **take position** in one transaction.

| Pillar | What it does |
| :--- | :--- |
| Tokenized equities | Stock tokens on Robinhood Chain, each listed in its own isolated pair |
| Leveraged long / short | 1.25× and 1.5× long, 1.0× and 1.25× short, opened and closed atomically by the margin router |
| Borrowing & credit | Post stock as collateral and borrow USDG; lenders supply USDG to an ERC-4626 vault |

## Architecture

```
Wallet
  │
  ├── OrionRouter ─────────── direct lending (deposit · borrow · repay · withdraw)
  ├── LeverageRouter / ShortRouter / MarginRouter ── atomic long & short
  └── AutoProtectModule ───── keeper deleverage
          │
          ▼
     OrionPair (isolated, one per side per equity)
          │
     Reference oracle (freshness + spread guards)
          │
     OrionMarketRegistry (tiers, caps)        OrionVault (ERC-4626, USDG)
```

Every protocol contract is a UUPS implementation behind an ERC-1967 proxy (`OrionProxies`).

## Monorepo

| Path | Contents |
| :--- | :--- |
| `apps/web` | Next.js 14 app: landing, markets, trade, lending, earn, portfolio, analytics, docs |
| `apps/api` | Express API over Postgres/PostgREST (the browser never talks to the database) |
| `apps/indexer` | Onchain event indexer |
| `apps/keeper` | Auto-Protect keeper |
| `apps/price-oracle` | Reference price publisher |
| `packages/contracts` | Foundry project: `Orion*` contracts, routers, oracle, vault, tests |
| `packages/types` | Shared TypeScript types |
| `supabase/` | SQL migrations and local fixture |
| `docker/` | Local and production compose stacks |

## Quick start

```bash
pnpm install
pnpm localnet:up      # Postgres + PostgREST in Docker, generated .env files
pnpm dev:core         # web :3002, API :3001
```

Contracts:

```bash
cd packages/contracts && forge test
```

More: [`docs/LOCALHOST.md`](docs/LOCALHOST.md), [`docs/TESTNET.md`](docs/TESTNET.md), [`docs/BRANCHING.md`](docs/BRANCHING.md),
[`docs/HOSTING.md`](docs/HOSTING.md).

## Branches

`main` (integration) → `testnet` (Robinhood Chain testnet, 46630) → `mainnet` (Robinhood Chain, 4663).

## License

MIT
