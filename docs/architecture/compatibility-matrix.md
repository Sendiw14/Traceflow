# Compatibility Matrix (M1 candidate)

**Status:** CANDIDATE. Versions below are upstream latest releases observed 2026-11-22 via `gh api repos/<r>/releases/latest` and local tooling. **Not evidence of a working install.** M2 must lock exact versions in lockfiles/go.mod and record build results here.

| Layer | Candidate | Source checked | License | M2 verification | Upgrade owner |
| --- | --- | --- | --- | --- | --- |
| Go | 1.27.4 | local `go version` | BSD-3 | `go build`, `go vet`, `go test -race` | Opus |
| PostgreSQL | 18.7 (image `postgres:18.7`, pin digest) | spec §3 | PostgreSQL | migrations + tests on container | Opus |
| OTel Collector | contrib/core v0.165.0 (2026-11-07) | GitHub releases | Apache-2.0 | confirm `otlphttp` exporter `sending_queue.batch` schema in this release; no `batch` processor | Opus |
| OTLP proto | v1.11.1 (`go.opentelemetry.io/proto/otlp`) | GitHub releases | Apache-2.0 | golden decode tests | Opus |
| OTel Go SDK (demo) | v1.47.0 | GitHub releases | Apache-2.0 | demo services emit traces | Opus |
| pgx | v5.11.0 | GitHub releases | MIT | integration tests | Opus |
| sqlc | v1.31.1 | GitHub releases | MIT | generate against PG 18 schema; fallback hand-written pgx queries | Opus |
| goose (migrations) | v3.30.1 | GitHub releases | MIT | forward migrations in CI | Opus |
| oapi-codegen | v2.9.0 (2026-11-21, very new — consider prior patch) | GitHub releases | Apache-2.0 | Go server types from `api/openapi.yaml` | Opus |
| openapi-typescript + openapi-fetch | latest 7.x/0.x at install | npm | MIT | TS client generation, `tsc` | Sonnet |
| Next.js | 16.4.6 (2026-11-09) | GitHub releases | MIT | build, lint, typecheck; `no-store` headers on private routes | Sonnet |
| React | 19.3.x per Next peer range | spec §3 | MIT | build | Sonnet |
| TypeScript | 7.0 if toolchain passes, else 6.x (ADR) | spec §3 | Apache-2.0 | Next + ESLint + generator + editor | Sonnet |
| Node.js | 26.x LTS in containers; local is 24.11.1 (R-11) | local + spec | MIT | container build | Opus |
| pnpm | 9.15.9 local; pin via `packageManager` | local | MIT | `pnpm install --frozen-lockfile` | Opus |
| Tailwind | 4.3.x | spec §3 | MIT | CSS-first config | Sonnet |
| Auth library | better-auth v1.7.27 (proposed, ADR-0005) | GitHub releases | MIT | OAuth state/CSRF, session tests | Opus |
| ECharts / React Flow | latest at install | npm | Apache-2.0 / MIT | bundle size, a11y | Sonnet |
| Playwright, Vitest, axe-core | latest at install | npm | Apache-2.0 / MIT / MPL-2.0 | CI | Sonnet |
| Caddy | 2.x latest at install | docs | Apache-2.0 | TLS in prod profile | Opus |

Last security check: NOT TESTED (no dependencies installed yet).
