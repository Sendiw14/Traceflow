# Compatibility Matrix (M2 — partially verified)

**Status:** M2 rows marked PASS were verified locally on 2026-11-22; others remain CANDIDATE. Versions below are upstream latest releases observed 2026-11-22 via `gh api repos/<r>/releases/latest` and local tooling. **Not evidence of a working install.** M2 must lock exact versions in lockfiles/go.mod and record build results here.

| Layer | Candidate | Source checked | License | M2 verification | Upgrade owner |
| --- | --- | --- | --- | --- | --- |
| Go | 1.27.4; image `golang:1.27.4-alpine@sha256:70bd7dde…` | local `go version` | BSD-3 | **PASS (M2, local)**: vet, `test -race`, build, Docker build | Opus |
| PostgreSQL | 18.7, `postgres:18.7@sha256:eb63372c…` | Docker Hub | PostgreSQL | **PASS (M2)**: container healthy, trace-api readiness ping; migrations at M3 | Opus |
| OTel Collector | contrib 0.165.0, `@sha256:e40d61f1…` | GitHub releases, `components` | Apache-2.0 | **PASS (M2)**: exporter is named `otlp_http` in this release; `sending_queue.batch` accepted by `validate` (negative control with unknown key rejected); container runs. Export to receiver NOT TESTED until M3 | Opus |
| OTLP proto | v1.11.1 (`go.opentelemetry.io/proto/otlp`) | GitHub releases | Apache-2.0 | golden decode tests | Opus |
| OTel Go SDK (demo) | v1.47.0 | GitHub releases | Apache-2.0 | demo services emit traces | Opus |
| pgx | v5.11.0 (go.mod) | GitHub releases | MIT | **PASS (M2)**: pool + ping; integration tests at M3 | Opus |
| sqlc | v1.31.1 | GitHub releases | MIT | generate against PG 18 schema; fallback hand-written pgx queries | Opus |
| goose (migrations) | v3.30.1 | GitHub releases | MIT | forward migrations in CI | Opus |
| oapi-codegen | v2.9.0 (2026-11-21, very new — consider prior patch) | GitHub releases | Apache-2.0 | Go server types from `api/openapi.yaml` | Opus |
| openapi-typescript + openapi-fetch | 7.13.0 / 0.17.0 | npm | MIT | **PASS (M2)**: `gen:api`, no diff vs committed client | Sonnet |
| Next.js | 16.4.6 | GitHub releases | MIT | **PASS (M2)**: build, lint, typecheck; `/app` dynamic, `Cache-Control: private, no-store` via `next start` | Sonnet |
| React | 19.3.1 | spec §3 | MIT | **PASS (M2)**: build | Sonnet |
| TypeScript | **6.0.3** (ADR-0006: 7.0.2 breaks openapi-typescript) | spec §3 | Apache-2.0 | **PASS (M2)**: typecheck | Sonnet |
| Node.js | 26 (`.nvmrc`, CI `setup-node`); local is 24.11.1 (R-11) | local + spec | MIT | CI only; NOT TESTED locally | Opus |
| pnpm | 9.15.9 via root `packageManager` | local | MIT | **PASS (M2)**: `install --frozen-lockfile` on fresh worktree | Opus |
| Tailwind | 4.3.5 | spec §3 | MIT | **PASS (M2)**: build with token CSS variables | Sonnet |
| Auth library | better-auth 1.7.27 (ADR-0005) | GitHub releases | MIT | **PASS (M2 spike, 24/24, mocked GitHub)**: state, PKCE S256, redirect validation, `__Host-` cookies (needs config), logout, cross-origin rejection | Opus |
| ECharts / React Flow | latest at install | npm | Apache-2.0 / MIT | bundle size, a11y | Sonnet |
| Playwright, Vitest, axe-core | 1.65.1 / 5.1.1 / not yet installed | npm | Apache-2.0 / MIT / MPL-2.0 | Vitest PASS 4/4; Playwright 2/2 (Sonnet-reported); axe NOT TESTED | Sonnet |
| Caddy | 2.x latest at install | docs | Apache-2.0 | TLS in prod profile | Opus |
| distroless static | `gcr.io/distroless/static-debian12:nonroot` @sha256:afa5c872… | — | Apache-2.0 | trace-api runtime image, non-root | Opus |
| gitleaks | v8.30.1 `@sha256:c00b6bd0…` | GitHub releases | MIT | **PASS (M2)**: history scan, no leaks | Opus |
| actionlint | 1.7.12 | GitHub releases | MIT | **PASS (M2)** on `ci.yml` | Opus |
| node base image | `node:26-alpine` (tag only; digest pin pending) | Docker Hub | MIT | Docker build **BLOCKED** (daemon stalls on pull) | Sonnet |
| GitHub Actions | checkout v7.0.1, setup-go v7.1.0, setup-node v7.1.0, pnpm/action-setup v6.1.1 — pinned by commit SHA | GitHub API | MIT | CI NOT TESTED (repo not pushed) | Opus |

Last security check: secret scan PASS 2026-11-22 (gitleaks). Dependency/image vulnerability scan NOT TESTED (add at M2 close or M6).
