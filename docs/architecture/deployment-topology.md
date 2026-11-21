# Deployment Topology (M1 draft)

**Status:** DRAFT. Owner decisions: `local-dev` first; `operator-prod` host before M8; `public-demo` on its own VPS (risks.md U-01, U-04).

## Networks (Docker Compose)

| Network | Members | Exposed to host/internet |
| --- | --- | --- |
| `edge` | caddy, web | Caddy 443/80 only (prod); `local-dev` binds web on `127.0.0.1:3000` |
| `app` | web, trace-api (query :8080) | none |
| `ingest` | demo services, collector, trace-api (ingest :4318) | none (`local-dev` may bind collector `127.0.0.1:4318` for local SDKs) |
| `data` | trace-api, postgres | none |

trace-api joins `app`, `ingest`, `data`. Postgres only on `data`. Web never on `data` or `ingest`.

## Profiles

| Aspect | `local-dev` | `operator-prod` | `public-demo` |
| --- | --- | --- | --- |
| Host | developer machine | single VPS (TBD pre-M8) | separate small VPS |
| Data | demo services + local SDKs | operator telemetry (personal projects) | synthetic seed only |
| Ingest listener | on (private network) | on (private network); remote off unless ADR | **off** (process refuses to start it) |
| DB role | `traceflow_rw` | `traceflow_rw` + `traceflow_ro` | `traceflow_ro` only; seeding via one-shot job with separate creds, not in runtime env |
| Auth | bootstrap session; refuses to start if `NODE_ENV=production` or bound to non-loopback | GitHub OAuth + numeric ID allowlist | none; read-only demo routes only |
| TLS | none (loopback) | Caddy ACME | Caddy ACME |
| Retention | 7 d if disk budget permits | from capacity profile | 1 d, re-seeded |
| Backups | none | encrypted, off-server | not needed (re-seedable) |

## Guard rails

- `TRACEFLOW_PROFILE` is required; no default in production images.
- `public-demo` startup fails if any ingest/admin config or a read-write DB URL is present.
- Bootstrap auth code path compiled in but disabled unless `TRACEFLOW_PROFILE=local-dev` **and** listener is loopback.
