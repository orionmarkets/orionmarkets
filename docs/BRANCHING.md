# Branching

Three branches, one per environment, and no others. There are no feature branches and no pull requests.

| Branch | Meaning |
| :--- | :--- |
| `main` | Integration. Every change is committed here first |
| `testnet` | What is released on Robinhood testnet (46630): code, testnet config template, deployment records |
| `mainnet` | What is released on Robinhood mainnet (4663) |

```
main  ──merge──▶  testnet  ──merge (after acceptance)──▶  mainnet
```

## Rules

- Commit directly to `main`. Do not create `feature/*`, `fix/*` or `chore/*` branches; if one is made by accident, merge it into `main` and delete it the same day.
- Promote by merging **forward only**: `main → testnet → mainnet`, with `--no-ff` so each release is one merge commit.
- No pull requests are needed, including between the three branches. After a push to `testnet` or `mainnet`, GitHub shows a "Compare & pull request" banner: ignore it. Never merge `testnet` or `mainnet` back into `main`.
- Deployment records (`packages/contracts/deployments/*.json`) are written on the branch of the network they describe. Since 2026-10-21 `main` also carries copies of them; the web build reads none of these files, so they do not change the site.
- A merge into `mainnet` requires the Phase 0 checklist in [`MAINNET.md`](MAINNET.md) and an owner sign-off.
- Secrets are never committed on any branch. `.env*` is ignored except `*.example`.

## Commands

```bash
git switch main && git pull --ff-only
# ...commit the change on main...
git push origin main

git switch testnet && git pull --ff-only && git merge --no-ff main && git push origin testnet     # promote to testnet
git switch mainnet && git pull --ff-only && git merge --no-ff testnet && git push origin mainnet  # promote to mainnet, after acceptance
```

## Hosting

Both sites run on one VPS (see [`HOSTING.md`](HOSTING.md)): `testnet.orionmarkets.tech` serves the `testnet` branch,
`orionmarkets.tech` serves the `mainnet` branch. GitHub Actions only builds (`.github/workflows/build.yml`); the VPS pulls
and rebuilds its branch on deploy, so no build artifacts are stored in CI.
