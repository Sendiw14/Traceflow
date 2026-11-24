# Security Testing Evidence

| ID | Area | Test / evidence | Result | Date |
| --- | --- | --- | --- | --- |
| T-01/T-20 | Unauthenticated /app, bootstrap misuse | Playwright + manual operator-prod run: /app/* → 307 /login; raw RSC request → no trace data; bootstrap only for loopback Host | PASS | 2026-11-25 |
| T-02 | OAuth CSRF / open redirect | core.integration.test.ts: state + PKCE S256; external callbackURL refused; wrong state → no session | PASS | 2026-11-25 |
| T-03 | Username-change bypass | allowlist on numeric `accountId`; renamed login allowed, other ID denied with no rows | PASS | 2026-11-25 |
| T-04 | Session cookie | `__Host-tf_session` Secure HttpOnly SameSite=Lax Path=/ no Domain, 12 h idle, 7 d absolute (unit) | PASS | 2026-11-25 |
| T-05 | CSRF on sign-out / actions | cross-origin sign-out 403 (after forcing better-auth origin check on); Server Actions re-check access | PASS | 2026-11-25 |
| T-06 | Private caching / logout | /app `private, no-store`; Clear-Site-Data on sign-out | PASS | 2026-11-23/25 |
| T-08/T-09 | Decompression bomb / overload | OTLP-07/08/10 handler tests | PASS | 2026-11-22 |
| T-14 | DB least privilege | roles_integration_test.go (42501 on DDL; auth role isolated) | PASS | 2026-11-25 |
| T-15 | Demo/private isolation | profile gating proxy + layouts + actions; bypass headers ineffective | PASS (config); deployed isolation NOT TESTED | 2026-11-24 |
| T-17 | Supply chain | gitleaks history; Trivy fail-gate on our images + lockfiles; CycloneDX SBOM | PASS (CI 45494165929) | 2026-11-25 |

## Third-party image findings (report-only, decision needed before release)
| Image | Findings (fixable) | Location | Note |
| --- | --- | --- | --- |
| postgres:18.7 | 26 (25 HIGH, 1 CRITICAL CVE-2025-68121) | `usr/local/bin/gosu` (old Go stdlib) | still present in the 2026-11 upstream rebuild (digest c6993038, repinned M7). Options: accept (gosu only drops root at entrypoint) or switch to `postgres:18.7-alpine` (su-exec) before first production data — owner decision |
| otel/opentelemetry-collector-contrib:0.165.0 | 1 HIGH | collector binary | upgrade with next Collector release after config re-validation |

## Not yet done
Independent (human) security review of docs/security and the auth implementation; penetration test of a deployed operator-prod; rate limiting on auth routes; CSP header.
