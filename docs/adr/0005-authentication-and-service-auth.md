# ADR-0005: Operator authentication and BFF→API service auth

- **Status:** Accepted — owner approved 2026-11-22; M2 spike PASS 24/24 (`docs/testing/auth-spike.md`) with the required configuration below.
- **Date:** 2026-11-22
- **Requirements:** SCOPE-07, AC-AUTH-01, AC-AUTH-02

## Decision
1. **Operator login** (`operator-prod`): GitHub OAuth via a maintained library — proposed **better-auth** (active releases, MIT). Alternative: Auth.js. Final choice after M2 spike verifying state/PKCE, redirect validation, session rotation and logout.
2. **Allowlist** by immutable GitHub numeric user ID, from env `TRACEFLOW_OPERATOR_GITHUB_IDS` (comma-separated). Username never used for authZ. Non-allowlisted login → denied page, no session.
3. **Session:** server-side session store in PostgreSQL (separate `auth` schema, separate DB role from trace data), cookie `__Host-` prefixed, `HttpOnly; Secure; SameSite=Lax`, idle 12 h, absolute 7 d; logout deletes server session.
4. **AuthZ** checked server-side in every `/app/*` route handler/server component and every BFF route; middleware alone is not trusted.
5. **BFF → Go query API:** static random 256-bit service token from env, compared constant-time; rotated by redeploy. Query listener only on private `app` network.
6. **local-dev bootstrap:** fixed local operator session without OAuth, enabled only when `TRACEFLOW_PROFILE=local-dev` and bound to loopback; startup fails otherwise.
7. **public-demo:** no auth subsystem; only `/demo/*` data routes enabled; BFF holds a demo-only service token for a read-only API instance.

## Spike-derived requirements (binding for implementation)
- Cookie names `__Host-tf_session`, `__Host-tf_session_data`, `__Host-tf_state` with `useSecureCookies: false` and `defaultCookieAttributes { secure: true, httpOnly: true, sameSite: "lax", path: "/" }`; M6 test asserts `Secure`, `Path=/`, no `Domain`.
- Lifetime: `expiresIn` 12 h, `updateAge` 1 h, plus server-side rejection of sessions older than 7 d (`createdAt`).
- Allowlist enforced in `databaseHooks.account.create.before` on `accountId` (numeric GitHub ID); also enforced on any account-link path.
- Denied login redirects to the `/login` denied state, never raw JSON.

## Open
- Library confirmed: better-auth 1.7.27 (spike PASS). Real GitHub OAuth NOT TESTED until an OAuth app exists (pre-M8).
- Whether auth schema lives in same PG instance (proposed: yes, separate schema + role) — owner review.

## Amendments (M6 implementation, 2026-11-25)
1. **Separate auth database** `traceflow_auth`, owned by role `traceflow_auth`, instead of an `auth` schema in the trace database. That role cannot connect to the trace database and the trace roles cannot connect to it (proved in `roles_integration_test.go`). The web service never holds trace-database credentials.
2. **Origin/CSRF checks forced on.** better-auth 1.7.27 silently skips its origin, CSRF and callbackURL checks when `NODE_ENV=test` or `TEST=true` (`create-context.mjs`: `skipOriginCheck` defaults to `isTest()`). Found by the M6 integration test, not by the spike. `advanced.disableOriginCheck: false` is now set explicitly.
3. **Denied login** is turned into `302 /login?error=denied` by `handleAuthRequest` (better-auth returns raw 403 JSON when the allowlist hook rejects); `Clear-Site-Data` on sign-out; `no-store` on all auth responses.
4. **Account linking disabled** (`account.accountLinking.enabled: false`), so no path can attach a GitHub account outside the `account.create.before` allowlist hook.
5. **Allowlist and absolute cap re-checked per request** in `getOperator()`: removing an ID takes effect immediately; sessions older than 7 days are revoked.
6. **local-dev bootstrap** identity (actor sentinel `"0"`) is honoured only for loopback `Host` headers; public-demo has no auth subsystem; operator-prod with incomplete or invalid auth env serves no auth routes (fail closed).
Code: `apps/web/src/lib/auth/{config,core,server}.ts`, `apps/web/src/app/api/auth/[...all]/route.ts` (Opus-owned).
