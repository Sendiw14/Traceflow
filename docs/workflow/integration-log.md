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

## M1-D — Design system, page matrix, consumer review

```text
TASK_ID: M1-D1..D4, M1-R1 | BASE_COMMIT_SHA: 9089e9b | BRANCH/PR: claude/vigorous-yalow-e6f487 (local only, not pushed)
MODEL/EFFORT/ULTRACODE VERIFIED: claude-sonnet-5-5 / NOT TESTED / NOT TESTED
OWNER: Sonnet | REVIEWER: Opus (data semantics, OpenAPI changes), independent a11y/visual reviewer, repository owner — all pending
REQUIREMENT_IDS: SCOPE-05, SCOPE-06, SCOPE-08, SCOPE-09, NFR-01, NFR-04, AC-UX-01, AC-A11Y-01, AC-A11Y-02, AC-API-01 (consumer review)
FILES_CHANGED: docs/design/{benchmark,identity,design-tokens,typography,grid-breakpoints,page-matrix,component-inventory,motion-spec,accessibility-matrix,asset-inventory,openapi-consumer-review}.md, docs/design/tools/contrast.py, docs/workflow/{model-availability,integration-log}.md (append only)
CONTRACT_VERSION CONSUMED / CONTRACT_CHANGES: api/openapi.yaml 0.1.0-draft / none made; changes REQUESTED in docs/design/openapi-consumer-review.md (blocking: R-3 latency distribution, R-4a exemplar trace ids)
BEHAVIOUR IMPLEMENTED: none (design documentation only; no code, no scaffolding, no dependencies)
SECURITY / DATA IMPACT: none; no secrets; no external requests; no assets imported
COMMANDS RUN + ACTUAL RESULTS: `python3 docs/design/tools/contrast.py` → all text/UI/on-fill pairings in design-tokens.md §1 meet thresholds (min text 4.52:1 signal on violet-tint; min UI 3.19:1 control-border on sunken); intentionally sub-threshold decorative tokens listed. `claude --version` → 2.1.319. Rendered-pixel verification not performed.
TEST FIXTURES: none
KNOWN FAILURES / UNTESTED: effort/Ultracode unverified; font + icon licences not verified against upstream (no network); payload sizes in review are estimates; CVD simulation, SR, keyboard E2E, zoom/reflow all NOT TESTED (no UI exists); dropped ink-4 (#6B7487, 4.45 on canvas) because it failed
DEPENDENCIES / NEXT HANDOFF: Opus responds to consumer review (R-3, R-4a blocking) and decides R-16/R-17 demo questions → Sonnet re-review → M1 contract freeze sign-off; owner reviews identity/typography choices (Instrument Serif/Inter/JetBrains Mono); M5 asset import with licence check
FINAL: NOT TESTED (design documents only; contrast arithmetic computed, everything else unverified; freeze blocked on review items)
```
