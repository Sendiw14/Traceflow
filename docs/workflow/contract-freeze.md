# M1 Contract Freeze — 1.0.0

**Date:** 2026-11-22 · **Approved by:** repository owner (in chat: "Merge and freeze") · **Coordinator:** Opus · **Consumer reviewer:** Sonnet (APPROVED 0.2.0; notes folded into 0.2.1 = 1.0.0)

## Frozen artifacts

| Artifact | Version / state | Owner |
| --- | --- | --- |
| `api/openapi.yaml` | 1.0.0 (content of 0.2.1-draft; Redocly lint valid, 2 accepted health-probe warnings) | Opus |
| `docs/architecture/api-contract.md` | 1.0.0 | Opus |
| ADR-0001…0004 | Accepted | Opus |
| ADR-0005 | Accepted **conditional** on M2 auth spike | Opus |
| `docs/architecture/data-model.md` | frozen design; becomes migration `00001_init.sql` at M3 | Opus |
| `docs/testing/fixtures.md` | frozen fixture contract | Opus |
| `docs/design/design-tokens.md`, `page-matrix.md`, `component-inventory.md`, `motion-spec.md`, `accessibility-matrix.md`, `identity.md`, `typography.md`, `grid-breakpoints.md`, `asset-inventory.md` | frozen at merge `21a703a` (their own headers still read DRAFT 0.1.0; Sonnet updates on next edit). `page-matrix.md` binds to 0.2.0 field names, all unchanged in 1.0.0 except `exemplars` and `service_count` now required | Sonnet |

## Not frozen (still open)
- `docs/architecture/capacity-profile.md` — PROVISIONAL until M3/M4 measurements.
- `docs/architecture/compatibility-matrix.md` — candidates; exact versions locked at M2.
- `docs/security/*` — draft; needs independent read-only security review + owner sign-off (gate M6 at latest, threat items feed M2–M5 tests).
- Effort level / Ultracode for both sessions — NOT TESTED (not inspectable in-session).

## Change rule after freeze
Contract changes require an ADR or change PR, `info.version` bump (breaking → major), regenerated Go/TS clients, and both contract suites green. No permissive `any`, removed assertions or static replacement data to hide drift (spec §14.5).

## Readiness level
(A) planning baseline ready — **for M2 entry**. No code exists; no B–E level is claimed.
