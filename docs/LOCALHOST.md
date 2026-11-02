# Running OrionMarkets on localhost

No cloud accounts and no secrets are needed. The stack is Postgres and PostgREST in Docker (a local stand-in for Supabase), the Express API, and the Next.js web app.

## Requirements

- Node `>= 22` (developed on 24) and pnpm `>= 9`
- Docker (the `docker compose` plugin)
- Foundry, only if you work on the contracts

## Start

```bash
pnpm install
pnpm localnet:up      # database, migrations, fixture, generated .env files
pnpm dev:core         # web :3002 and API :3001
```

Open <http://localhost:3002>. `pnpm dev:local` does both steps in one command.

| Port | Service |
| :--- | :--- |
| 3002 | Web (Next.js) |
| 3001 | API (Express) |
| 55621 | `/rest/v1` gateway (what the API treats as "Supabase") |
| 55623 | PostgREST |
| 55622 | Postgres (`postgres://postgres:orion_local_only@127.0.0.1:55622/orion`) |

Everything binds to `127.0.0.1` only. The credentials are throwaway values that exist solely in `docker/localnet/compose.yml` and the generated `.env` files.

## What you will see

| Area | Local behaviour |
| :--- | :--- |
| Landing page, 3D hero, every section | Fully working |
| Markets, Earn | Populated from `supabase/seed.sql`. **The numbers are an illustrative fixture, not real data** |
| Reference prices | Live, read from the public price providers |
| Analytics, Lending | Read the **real Orion testnet deployment** (`apps/web/.env` holds its addresses after the pipeline ran): Analytics reports 2 of 2 markets verified, Lending shows TSLA/USDG with execution disabled |
| Trade (long/short), Portfolio, Pons | Render with their empty or "not enabled" states: the markets are paused, and Pons has no testnet deployment |
| Wallet writes | Disabled: `LENDING_ENABLED`, `MARGIN_TRADING_ENABLED` and `TRADING_ENABLED` are `false`. Before any deployment the web env holds a schema-valid **placeholder** deployment instead of real addresses |

The deployment addresses are in [`TESTNET.md`](TESTNET.md). To try wallet flows, the market must be active and prices fresh: run the price publisher (`pnpm rh:publisher:serve`), then set `LENDING_ENABLED=true` in `apps/web/.env`. Browser-wallet flows have not been exercised yet, so treat them as untested.

## Commands

| Command | Effect |
| :--- | :--- |
| `pnpm localnet:up` | Start the stack; applies migrations and the fixture on a fresh database. Idempotent |
| `pnpm localnet:up --reseed` | Reload `supabase/seed.sql` |
| `pnpm localnet:up --force-env` | Rewrite the generated `.env` files. **This discards real deployment addresses** written by the testnet pipeline; do not run it after a deployment |
| `pnpm localnet:down` | Stop containers (data kept) |
| `pnpm localnet:reset` | Stop, delete the database volume, start fresh |
| `pnpm --filter @orion/web build` | Production build check |

## Troubleshooting

- **`Docker is not reachable`**: start Docker (or Podman's Docker socket) and retry.
- **Port already in use**: something else holds 3001, 3002 or 5432x. Stop it, or change the host port in `docker/localnet/compose.yml`.
- **API exits with `SUPABASE_SERVICE_ROLE_KEY: String must contain at least 1 character(s)`**: the API loads `../../.env.testnet` before `.env`, and dotenv does not override variables that are already defined. A deployment profile that carries `SUPABASE_*` or `DATABASE_URL` (placeholders copied from the template) shadows the local `.env`. Delete those keys from `.env.testnet`; the deployment pipeline does not use them.
- **`Invalid ENV fields: ...` when the web starts**: the web validates its environment strictly (zero-fallback). Before a deployment, `pnpm localnet:up --force-env` regenerates a valid placeholder one. After a deployment that would discard the real addresses, so restore them from `packages/contracts/deployments/testnet-46630.json` (on the `testnet` branch) instead.
- **Markets page empty**: confirm the API is up (`curl localhost:3001/health`) and the database has rows (`pnpm localnet:up --reseed`).
- **Hero shows a still logo instead of the 3D scene**: the browser could not create a WebGL context. The page still works; try a browser with hardware acceleration enabled.
- **Slow first page load in dev**: Next compiles routes on demand. `pnpm --filter @orion/web build && pnpm --filter @orion/web start` serves the optimized build.

## Tests

```bash
pnpm --filter @orion/contracts test          # 152 Foundry tests
pnpm --filter @orion/price-oracle test       # 15 oracle tests
pnpm lint                                   # typecheck every workspace
pnpm check:lending-abis                     # generated ABIs match compiled contracts
```

> The root `test:*` scripts (`test:lending-client`, `test:indexer`, ...) expect a `tests/` directory that is not part of this repository yet.
