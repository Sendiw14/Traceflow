# File Ownership (from spec §14.3)

One modifying owner per file. Reviewers are read-only.

| Paths | Owner | Reviewer |
| --- | --- | --- |
| `docs/requirements/`, `docs/workflow/`, root `CLAUDE.md`, `README.md` (technical), lockfiles, root config, CI, releases | Opus coordinator | Owner (scope), affected owner |
| `docs/architecture/`, `docs/adr/`, `infra/otel/`, `services/trace-api/**` | Opus | Independent architecture/OTLP review; Sonnet for frontend-impacting contracts |
| `api/openapi.yaml` | Opus | **Sonnet as consumer before freeze** |
| `docs/security/` | Opus | Independent security reviewer + owner |
| `docs/design/**`, `apps/web/**` (UI, components, pages, tests) | Sonnet | Opus (data semantics), a11y reviewer |
| `apps/web/src/lib/api/generated/**` | generated — nobody edits | CI diff check |
| `apps/web/src/lib/auth/**`, `apps/web/src/app/api/auth/**` (M6, ADR-0005) | Opus | Sonnet (integration), owner (high-risk security) |
| `/login` page UI, session checks wired into `/app` layouts and server actions | Sonnet | Opus (security review) |
| `examples/demo-system/**`, `compose*.yaml`, `infra/caddy/`, `Makefile` | Opus | correctness/security reviewer |
| `docs/testing/` | Opus (backend), Sonnet (frontend sections) — separate files | each other |
