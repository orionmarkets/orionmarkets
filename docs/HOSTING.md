# Hosting

One VPS (`160.238.36.55`) serves both networks. GitHub Actions only builds; the VPS pulls its branch and builds in place.

| Network | Domain | Branch | Web | API | Gateway | Postgres |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: |
| Testnet (46630) | `testnet.orionmarkets.tech` | `testnet` | 3102 | 3101 | 55721 | 55722 |
| Mainnet (4663) | `orionmarkets.tech` | `mainnet` | 3202 | 3201 | 55821 | 55822 |

All ports bind to `127.0.0.1`; Caddy (`deploy/Caddyfile`) terminates TLS and issues certificates automatically.

## Layout on the VPS

```
/opt/orion/<network>/
  repo/        git clone of github.com/orionmarkets/orionmarkets on branch <network>
  stack.env    POSTGRES_PASSWORD, AUTHENTICATOR_PASSWORD, JWT_SECRET, DB_PORT, GATEWAY_PORT (mode 600)
  root.env     API / indexer profile (copied to repo/.env and repo/.env.<network>)
  web.env      web profile plus WEB_PORT (copied to repo/apps/web/.env)
```

- Data: `docker compose -p orion-<network> --env-file /opt/orion/<network>/stack.env -f docker/production/compose.yml up -d`
- Apps: systemd units `deploy/orion-web@.service` and `deploy/orion-api@.service`, instance name = network.
- Deploy: `sudo -u orion /opt/orion/<network>/repo/deploy/deploy.sh <network>`

## DNS (Hostinger)

| Host | Record |
| :--- | :--- |
| `testnet` | `A 160.238.36.55` |
| `@` and `www` | `A 160.238.36.55` (phase 2, mainnet) |
