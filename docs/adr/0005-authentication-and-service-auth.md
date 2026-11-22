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
