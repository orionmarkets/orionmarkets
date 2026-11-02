# Hosting

One VPS (`160.238.36.55`) serves both networks. GitHub Actions only builds; the VPS pulls its branch and builds in place.

| Network | Domain | Branch | Web | API | Gateway | Postgres |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: |
| Testnet (46630) | `testnet.orionmarkets.tech` | `testnet` | 3102 | 3101 | 55721 | 55722 |
| Mainnet (4663) | `orionmarkets.tech` | `mainnet` | 3202 | 3201 | 55821 | 55822 |

The VPS also runs Coolify, whose Traefik proxy owns ports 80/443. ORIONMARKETS routes through it with a file-provider
config (`deploy/traefik-orion.yaml` → `/data/coolify/proxy/dynamic/orion.yaml`); Traefik issues Let's Encrypt
certificates. Next.js listens on the docker0 address (`172.16.0.1`) so Traefik can reach it via `host.docker.internal`;
everything else binds to `127.0.0.1`.

## Layout on the VPS

```
/opt/orion/<network>/
  repo/          clone of github.com/orionmarkets/orionmarkets on branch <network>, owned by user `orion`
                 env profiles live here, git-ignored: .env, .env.<network>, apps/web/.env (mode 600)
  stack.env      POSTGRES_PASSWORD, AUTHENTICATOR_PASSWORD, JWT_SECRET, DB_PORT, GATEWAY_PORT (mode 600)
  service.env    WEB_HOST, WEB_PORT for the web unit
```

- Data: `docker compose -p orion-<network> --env-file /opt/orion/<network>/stack.env -f docker/production/compose.yml up -d`
- Env files: `ORION_COMPOSE=… ORION_JWT_SECRET=… ORION_SUPABASE_URL=… node scripts/localnet/write-env.mjs` (same generator as localhost)
- Apps: systemd units `deploy/orion-web@.service`, `deploy/orion-api@.service` (instance = network)
- Deploy: `bash /opt/orion/<network>/repo/deploy/deploy.sh <network>`

## DNS (Hostinger)

| Host | Record |
| :--- | :--- |
| `testnet` | `A 160.238.36.55` |
| `@` and `www` | `A 160.238.36.55` (phase 2, mainnet) |
