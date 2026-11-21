# Integration Log

## M0-001 — Repository bootstrap and spec adoption

```text
TASK_ID: M0-001 | BASE_COMMIT_SHA: (none — initial commit) | BRANCH/PR: main (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus coordinator | REVIEWER: repository owner (pending)
REQUIREMENT_IDS: SCOPE-01…10, NFR-01…07 (drafted, not implemented)
FILES_CHANGED: CLAUDE.md, README.md, docs/specs/*, docs/requirements/*, docs/workflow/*
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: V2 spec adopted 2026-11-22 / none
BEHAVIOUR IMPLEMENTED: none (documentation only)
SECURITY / DATA IMPACT: none; no secrets, no telemetry
COMMANDS RUN + ACTUAL RESULTS: env inspection (see model-availability.md); git init
TEST FIXTURES: none
KNOWN FAILURES / UNTESTED: effort/Ultracode not verified; Node below baseline; blocking unknowns U-01…U-06
DEPENDENCIES / NEXT HANDOFF: owner review of M0 drafts → M0 gate → M1 contracts
FINAL: NOT TESTED (planning artifacts only; M0 gate requires owner review)
```

## M1-B — Backend contracts draft

```text
TASK_ID: M1-B1..B5 | BASE_COMMIT_SHA: 3a534ae | BRANCH/PR: main (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-opus-5-5 / NOT TESTED / NOT TESTED
OWNER: Opus | REVIEWER: Sonnet (OpenAPI consumer), independent security reviewer, owner (ADR-0005) — all pending
REQUIREMENT_IDS: SCOPE-02..04, SCOPE-07, SCOPE-08, SCOPE-10, NFR-02, NFR-03, NFR-05, NFR-06
FILES_CHANGED: docs/architecture/*, docs/adr/0001..0005, api/openapi.yaml, docs/security/*, docs/testing/fixtures.md, docs/workflow/{ownership,task-board}.md
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: none / introduces api 0.1.0-draft
BEHAVIOUR IMPLEMENTED: none (contracts only)
SECURITY / DATA IMPACT: defines boundaries; nothing deployed
COMMANDS RUN + ACTUAL RESULTS: `npx @redocly/cli@2 lint api/openapi.yaml` → valid, 2 warnings (health probes without 4xx, accepted); upstream release tags via `gh api` (see compatibility-matrix.md)
TEST FIXTURES: contract only (docs/testing/fixtures.md); none generated
KNOWN FAILURES / UNTESTED: capacity numbers assumed; Collector sending_queue.batch support in v0.165.0 unverified; auth library unspiked
DEPENDENCIES / NEXT HANDOFF: Sonnet M1-D1..D4 + R1 → contract freeze
FINAL: NOT TESTED (draft contracts; freeze pending reviews)
```
