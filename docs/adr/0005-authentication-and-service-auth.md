# ADR-0005: Operator authentication and BFF→API service auth

- **Status:** Accepted by owner 2026-11-22, conditional on M2 spike (state/PKCE, redirect validation, session rotation, logout). Spike failure reopens this ADR.
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

## Open
- Library confirmed only after M2 spike passes (owner approved approach 2026-11-22).
- Whether auth schema lives in same PG instance (proposed: yes, separate schema + role) — owner review.
