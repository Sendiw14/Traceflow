# Threat Model (M1 draft)

**Status:** DRAFT. Owner: Opus. **Requires independent read-only review and owner sign-off; not self-approved.** Method: trust boundaries + STRIDE per boundary, OWASP Top 10 / API Top 10 mapping. Telemetry attributes are untrusted input.

## Assets
A1 private operator telemetry · A2 operator session · A3 service token (BFF↔API) · A4 DB credentials · A5 OAuth client secret · A6 synthetic demo data integrity · A7 host availability.

## Trust boundaries

| ID | Boundary | Crosses |
| --- | --- | --- |
| TB-1 | Internet → Caddy | browser requests (prod/demo) |
| TB-2 | Caddy → Next.js BFF | authenticated + anonymous HTTP |
| TB-3 | BFF → trace-api query | service token |
| TB-4 | SDK/demo → Collector → trace-api ingest | untrusted OTLP payloads |
| TB-5 | trace-api → PostgreSQL | DB role creds |
| TB-6 | GitHub OAuth ↔ BFF | redirects, codes, tokens |
| TB-7 | public-demo deployment ↔ operator deployment | **must not exist** (separate hosts) |
| TB-8 | CI / supply chain → images | dependencies, actions, build secrets |

## Threats and mitigations

| ID | Boundary | Threat (STRIDE) | Mitigation | Test |
| --- | --- | --- | --- | --- |
| T-01 | TB-2 | Unauthenticated access to `/app/*` or BFF data routes (E) | Server-side session check in every route handler/server component; deny by default | AUTH-01 route sweep |
| T-02 | TB-6 | OAuth CSRF / code injection / open redirect (S,T) | Library-managed state + PKCE; return path allowlist (relative `/app…` only) | AUTH-03 |
| T-03 | TB-6 | Username change bypass (S) | Allowlist numeric GitHub ID | AUTH-04 |
| T-04 | TB-2 | Session fixation/theft (S) | `__Host-` HttpOnly Secure SameSite=Lax; rotate on login; server-side revocation on logout | AUTH-02 |
| T-05 | TB-2 | CSRF on settings mutation (T) | SameSite + Origin header check + POST-only mutation via server action/route | AUTH-05 |
| T-06 | TB-2 | Private data in shared/static cache or bfcache after logout (I) | `private, no-store`; dynamic rendering for `/app/*`; no `use cache`; `Clear-Site-Data` on logout | API-03, AUTH-06 |
| T-07 | TB-3 | Browser reaches Go API directly (E) | API on private network; no Caddy route; bearer token | DEPLOY net test |
| T-08 | TB-4 | Decompression bomb / oversize (D) | Compressed + decompressed limits, streaming LimitReader | OTLP-07/08 |
| T-09 | TB-4 | Flood / overload (D) | Concurrency semaphore → 429; Collector queue bounds | OTLP-10, PERF-02 |
| T-10 | TB-4 | Remote unauthenticated ingest exposure (E,T) | Ingest not routed publicly; remote ingest off by default; enabling needs ADR + token + TLS + rate limit | DEPLOY port scan |
| T-11 | TB-4→UI | Stored XSS via attribute/span names (T) | React escaping only; no `dangerouslySetInnerHTML`; render control/bidi chars visibly; length caps; CSP without `unsafe-inline` scripts | UX-XSS fixture |
| T-12 | TB-4 | Secrets/PII persisted from attributes (I) | Collector redaction processor (allowlist-first) **and** Go-side denylist before persistence | privacy tests |
| T-13 | TB-5 | SQL injection (T) | Parameterized pgx/sqlc only; no string-built SQL; filter values validated per OpenAPI | API fuzz |
| T-14 | TB-5 | Over-privileged DB role (E) | Separate migrate/rw/ro roles; demo runtime `ro` only | role tests |
| T-15 | TB-7 | Demo reaches private data (I) | Separate host, DB, creds; demo startup refuses rw DB URL / ingest config | DEMO-01 |
| T-16 | TB-3 | IDOR across workspaces (I) | V1 single workspace; `workspace_id` fixed server-side, never from request | API test |
| T-17 | TB-8 | Malicious dependency / leaked CI secret (T,I) | Lockfiles, SCA, image scan, secret scan, pinned action SHAs, least-privilege `GITHUB_TOKEN` | CI gates |
| T-18 | all | Secrets in logs / self-telemetry (I) | Structured logging with redaction; never log tokens, cookies, auth headers, raw payloads | log grep test |
| T-19 | TB-4 | Self-telemetry feedback loop (D) | trace-api self-tracing off by default; if enabled, separate service name + sampling and excluded from own ingest loop | ops test |
| T-20 | TB-2 | Local bootstrap auth used in prod (E) | Enabled only for `local-dev` + loopback; startup failure otherwise | AUTH-07 |

## Residual risks
- Single operator; no MFA enforcement beyond GitHub account's own.
- Collector-to-receiver traffic unauthenticated inside private network (accepted for V1; network isolation is the control).
- Same-model review is not an independent audit (R-13).
