# Runbook — operator-prod deployment (single server)

**Status:** configuration written M6 (2026-11-25): `compose.production.yaml`, `infra/caddy/Caddyfile`. **Not yet deployed anywhere.** Requires owner decisions still open (host, domain, GitHub OAuth app — risks.md U-01/U-03). Do not expose `/app` before sign-in is verified end to end with the real GitHub app.

## Topology
- Only **Caddy** publishes ports (80, 443 TCP/UDP). It terminates TLS (automatic ACME) and proxies to `web:3000`; `/v1/traces` is answered 404 at the edge.
- `web` (operator-prod): site, docs, `/app`, `/login`, BFF. `/demo` is 404 in this profile.
- `trace-api` runs as `traceflow_app` (no DDL); `migrate` runs once per deploy as the PostgreSQL superuser.
- `web` reaches PostgreSQL only on the internal `auth` network with `traceflow_auth` credentials, which cannot open the trace database.
- Remote OTLP ingest is **off**: the Collector is on the internal `ingest` network only. Instrumented services on the same host join that network:
  `docker network connect traceflow-prod_ingest <container>` and export to `http://collector:4318/v1/traces`.
  Exposing ingest beyond the host needs an ADR (authentication, TLS, rate limits) first.

## Prerequisites (owner)
- A Linux host sized from `docs/architecture/capacity-profile.md`; Docker Engine + Compose plugin; `age` for backups.
- DNS `A`/`AAAA` record for `TRACEFLOW_DOMAIN` → host; ports 80/443 reachable for ACME.
- A GitHub OAuth app: callback `https://<domain>/api/auth/callback/github`.
- Your numeric GitHub user ID (`gh api user --jq .id`) for `TRACEFLOW_OPERATOR_GITHUB_IDS`.
- Images built and pushed to a registry, referenced by immutable tag or digest in `TRACEFLOW_TRACE_API_IMAGE` / `TRACEFLOW_WEB_IMAGE` (release pipeline: M8).

## `.env.production` (never commit; mode 600)
| Variable | Notes |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | superuser for `migrate` only; random 32-byte hex password |
| `TRACEFLOW_APP_DB_PASSWORD`, `TRACEFLOW_RO_DB_PASSWORD`, `TRACEFLOW_AUTH_DB_PASSWORD` | random hex (URL-safe) |
| `TRACEFLOW_SERVICE_TOKEN` | `openssl rand -hex 32` |
| `TRACEFLOW_AUTH_SECRET` | `openssl rand -hex 32` |
| `TRACEFLOW_DOMAIN`, `TRACEFLOW_ACME_EMAIL` | public hostname; ACME contact |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | from the OAuth app |
| `TRACEFLOW_OPERATOR_GITHUB_IDS` | comma-separated numeric IDs |
| `TRACEFLOW_TRACE_API_IMAGE`, `TRACEFLOW_WEB_IMAGE` | pinned image references |

The web app refuses to serve sign-in (and so `/app`) if any auth variable is missing or invalid (fail closed).

## First deploy
```bash
docker compose -f compose.production.yaml --env-file .env.production config -q   # validates all variables
docker compose -f compose.production.yaml --env-file .env.production up -d --wait
```
Then: open `https://<domain>/login`, sign in with the allowlisted account, confirm a non-allowlisted account is denied, confirm `/demo` and `/v1/traces` return 404, set up the daily backup (backup-restore.md) and run a restore drill.

## Update
1. Run a backup.
2. Change the image references, then `docker compose ... up -d --wait` (runs `migrate` first; migrations are forward-only).
3. Rollback = previous image references **and** restore if a migration ran (no down-migrations).
