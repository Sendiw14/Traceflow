# TRACEFLOW

*Every request has a story. See the whole picture.*

Self-hostable, open-source distributed tracing: send OpenTelemetry traces, then find slow and failing requests, follow them across services and see which services call which — from recorded evidence only.

**Status: V1 in development.** The local stack works end to end (OTLP ingest → PostgreSQL → query API → web app). Hosted deployment is configured but not yet deployed or verified with a real GitHub sign-in. See [docs/workflow/task-board.md](docs/workflow/task-board.md) and [docs/testing/release-evidence.md](docs/testing/release-evidence.md).

## Quickstart (local, about 5 minutes)

Prerequisites: Docker with the Compose plugin, `make`, `openssl`, Git.

```bash
git clone https://github.com/Sendiw14/Traceflow.git
cd Traceflow
```

<!-- quickstart:start — CI runs the bash blocks between these markers verbatim -->
```bash
make env   # writes .env with fresh random local secrets (never overwrites an existing .env)
make up    # builds and starts PostgreSQL, trace-api, web, the Collector and three demo services
```

Generate one trace per demo scenario and print their IDs:

```bash
docker compose run --rm load
```
<!-- quickstart:end -->

It prints lines like `slow 4873bbc6… 200`: scenario, trace ID, HTTP status (the `error` scenario returns 502 on purpose). A `traffic` service also repeats the scenarios every 15 seconds.

## Find the slow span

1. Open **http://127.0.0.1:3000/app/traces** (the web app is published on `127.0.0.1` only).
2. Set *Min duration* to `800ms`, or paste the `slow` trace ID into `/app/traces/<trace ID>`.
3. In the waterfall, the widest bar is **`SELECT stock`** in **inventory** (≈ 820 ms): the database call that makes the request slow.
4. For the `error` trace, use *Next error span*; the `missing-parent` trace shows a span under "Parent span not received" instead of inventing a parent.

Stop with `make down` (data stays in the `pgdata` volume).

## What's inside

| Path | What |
| --- | --- |
| `services/trace-api` | Go: OTLP/HTTP receiver (`:4318`, private) and query API (`:8080`, private) |
| `apps/web` | Next.js: public site, docs, `/app` diagnostics, server-side BFF |
| `api/openapi.yaml` | Query API contract (1.0.0) — Go models and the TS client are generated from it |
| `infra/otel` | Pinned OpenTelemetry Collector config (redaction, bounded queue) |
| `examples/demo-system` | Three instrumented demo services with deterministic scenarios |
| `compose.yaml` / `compose.production.yaml` | Local stack / single-server operator deployment (Caddy TLS) |
| `docs/` | Spec, requirements, architecture + ADRs, design, security, testing, runbooks |

## Documentation

- In the app: **http://127.0.0.1:3000/docs** (getting started, instrumentation, architecture, deployment, security).
- Canonical spec: [docs/specs/TRACEFLOW_FINAL_MASTER_PROMPT_V2.md](docs/specs/TRACEFLOW_FINAL_MASTER_PROMPT_V2.md) · agent instructions: [CLAUDE.md](CLAUDE.md).
- Operations: [deployment](docs/runbooks/deployment.md), [backup and restore](docs/runbooks/backup-restore.md).

## Security

No sign-in in `local-dev`: keep the web app on `127.0.0.1` (the default). Remote OTLP ingest is off by default. See [docs/security/](docs/security/) and the in-app `/docs/security` page. No compliance certification is claimed.

## License

[Apache-2.0](LICENSE).
