# Auth Spike — better-auth 1.7.27 (M2-002, ADR-0005)

**Date:** 2026-11-22 · **Owner:** Opus · **Result:** PASS 24/24 with the configuration below · **Script:** [`spikes/auth-better-auth/spike.mjs`](spikes/auth-better-auth/spike.mjs)

## Method
- better-auth 1.7.27 + `pg` 8 in Node 24.11.1, against a throwaway `postgres:18.7` container (loopback port, `auth` schema, better-auth's own migrations).
- Requests go through `auth.handler` (the same handler Next.js mounts), origin `https://traceflow.test`.
- **GitHub is mocked** by intercepting `fetch` to `github.com` / `api.github.com`. Real GitHub OAuth is NOT TESTED (no OAuth app yet; deferred to pre-M8, U-03).
- Allowlist implemented as a `databaseHooks.account.create.before` hook rejecting any `accountId` (numeric GitHub ID) not in the configured set.

## Results

| ID | Check | Result |
| --- | --- | --- |
| T1 | Authorization URL has 32-char `state`, `code_challenge_method=S256`, `redirect_uri` = own callback; state cookie HttpOnly, Secure, SameSite=Lax | PASS |
| T2 | External `callbackURL` (`https://evil.example/…`) rejected | PASS (403) |
| T3 | Callback with wrong `state` → no session | PASS (302 to error page, `state_mismatch`) |
| T4 | Token request sends `code_verifier`; redirect to `/app`; session cookie `__Host-tf_session; Path=/; HttpOnly; Secure; SameSite=Lax`, no `Domain`; stored `accountId` = numeric GitHub ID; `get-session` returns user | PASS |
| T5 | Re-login issues a new session token | PASS |
| T6 | Cross-origin sign-out rejected (403, no row deleted); same-origin sign-out deletes the server session; old token invalid afterwards | PASS |
| T7 | Non-allowlisted ID → no account, session or user row | PASS |
| T8 | Same numeric ID with changed login → still allowed | PASS |
| — | Tables live in the `auth` schema | PASS |

## Required configuration (findings)
1. **`__Host-` cookies need explicit config.** Default names are `__Secure-better-auth.*`. Setting a custom `name` while `useSecureCookies: true` produces the invalid `__Secure-__Host-…`. Working config: `useSecureCookies: false` plus `defaultCookieAttributes: { secure: true, httpOnly: true, sameSite: "lax", path: "/" }` and `cookies.{session_token,session_data,state}.name = "__Host-tf_*"`. Because `useSecureCookies` is off, `Secure` must be asserted by a test in M6 (AUTH-02).
2. **Session lifetime semantics differ from ADR-0005.** better-auth's `expiresIn` is a sliding expiry refreshed every `updateAge`; there is no built-in absolute cap. To meet "idle 12 h, absolute 7 d": set `expiresIn: 12h`, `updateAge: 1h`, and reject sessions with `createdAt` older than 7 d in the server-side session check. NOT TESTED in this spike.
3. **Denied login returns raw JSON** (`403 {"message":"not on operator allowlist"}`) on the browser callback. M5/M6 must redirect to a `/login` denied state instead (e.g. error callback URL or hook mapping). NOT TESTED.
4. **Other sessions survive one logout.** Sign-out deletes only the current session; earlier sessions remain valid until expiry. Acceptable for single operator; "sign out everywhere" (`revokeSessions`) is a V2 option.
5. Allowlist must also cover the **account-link** path, not only first sign-up, when implemented (hook placement reviewed at M6).

## Not covered
Real GitHub, rate limiting on auth routes, session store under a separate DB role, CSP, Next.js integration (route handler + server components), Node 26.
