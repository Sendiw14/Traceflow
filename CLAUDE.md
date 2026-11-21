# TRACEFLOW — Claude Code Repository Instructions (V2)

**Project:** https://github.com/Sendiw14/Traceflow  
**Product:** White-first, open-source distributed tracing and diagnostics.  
**Status:** V2 adopted by the repository owner on 2026-11-22. Canonical spec: [`docs/specs/TRACEFLOW_FINAL_MASTER_PROMPT_V2.md`](docs/specs/TRACEFLOW_FINAL_MASTER_PROMPT_V2.md). Readiness audit (reference only): `docs/specs/archive/TRACEFLOW_FINAL_READINESS_AUDIT_V2.md`.

## One source of truth

1. Read `docs/specs/TRACEFLOW_FINAL_MASTER_PROMPT_V2.md` first. It is canonical (owner-adopted 2026-11-22). Previous integrated prompt, workflow and historical audit are reference-only, not competing mandates.
2. Then read approved `docs/requirements/{PRD.md,scope.md,traceability.md,acceptance-criteria.md}`, `docs/architecture/` and ADRs, `api/openapi.yaml`, `docs/design/`, `docs/security/` and `docs/workflow/` if present.
3. If M0/M1 docs do not exist yet, **create/review them before major coding**. Do not invent approvals or pretend missing source files were inspected.

## Preferred ownership (verify locally)

- **Opus 5.5 medium + Ultracode where actually supported:** technical coordinator, Go, OTLP, PostgreSQL, API, auth/security, infrastructure, release integration.
- **Sonnet 5.5 high + Ultracode where actually supported:** identity, white-first site/dashboard, chart and trace presentation, responsive UX, motion, frontend accessibility and tests.
- `Ultracode` is not an effort level: do not substitute `--effort ultracode` for distinct high/medium. Confirm real model/effort/mode, account access and Claude Code version; log substitutions.
- One modifying owner per file, isolated branches/worktrees after an initial commit, read-only reviewers, contract reviews and evidence-gated integration.

## Non-negotiable implementation rules

- Real OTLP/HTTP binary Protobuf traces through a pinned Collector → Go → PostgreSQL; fixtures are not a substitute for actual ingestion.
- One versioned `api/openapi.yaml` source for app APIs; regenerate typed clients, never hand-edit generated types.
- Correct trace IDs, timestamps, concurrent/missing spans, late arrivals, replay handling, sampling caveats, OTLP response semantics, and evidence-grounded service edges.
- No unauthenticated public production ingestion. Separate read-only synthetic public demo deployment/data from operator private data.
- No secrets, tokens, private trace data in commits, CI, prompts or screenshots. Server-side authz and no-store private data.
- Maintain white-first art direction, WCAG 2.2 AA target, actual states/routes, reduced motion, clear diagnostic UX, and performance budgets.
- Do not skip M0/M1 contracts, silently change scope, merge failing CI, self-approve high-risk security decisions or claim unsupported completion.
- Every task records requirement IDs, branch SHA, owned files, actual commands/results, reviewer, evidence, failures and next gate. `PASS/FAIL/NOT TESTED/BLOCKED` are required statuses.

## First action

Inspect the **actual** repository, branch and tool/model configuration; establish M0 discovery deliverables and M1 architecture/contract/design work; obtain owner approval for paid/public/destructive decisions. Progress M0→M8 only with evidence-based milestone gates. Keep the README and this file synchronized with the canonical V2 specification.
