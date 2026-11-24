// SPDX-License-Identifier: Apache-2.0
// Owner: Opus (ADR-0005). better-auth wiring without Next.js runtime imports so it can be
// integration-tested in Node. Production entry points: ./server.ts and app/api/auth/[...all]/route.ts.

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import type { Pool } from "pg";

import { SESSION_IDLE_SECONDS, SESSION_UPDATE_AGE_SECONDS, type OperatorAuthConfig } from "./config";

export const COOKIE_NAMES = { session: "__Host-tf_session", sessionData: "__Host-tf_session_data", state: "__Host-tf_state" } as const;

export function buildAuth(cfg: OperatorAuthConfig, pool: Pool) {
  return betterAuth({
    baseURL: cfg.publicUrl,
    secret: cfg.secret,
    database: pool,
    trustedOrigins: [cfg.publicUrl],
    emailAndPassword: { enabled: false },
    socialProviders: { github: { clientId: cfg.githubClientId, clientSecret: cfg.githubClientSecret } },
    account: { accountLinking: { enabled: false } }, // ADR-0005: no link path around the allowlist
    session: { expiresIn: SESSION_IDLE_SECONDS, updateAge: SESSION_UPDATE_AGE_SECONDS },
    advanced: {
      // better-auth 1.7.27 skips its origin/CSRF + callbackURL checks when NODE_ENV=test or TEST=true
      // (create-context.mjs: skipOriginCheck defaults to isTest()). Force them on in every environment.
      disableOriginCheck: false,
      // __Host- cookies need Secure + Path=/ + no Domain; better-auth's own prefixing would break the name (spike finding 1).
      useSecureCookies: false,
      defaultCookieAttributes: { secure: true, httpOnly: true, sameSite: "lax", path: "/" },
      cookies: {
        session_token: { name: COOKIE_NAMES.session },
        session_data: { name: COOKIE_NAMES.sessionData },
        state: { name: COOKIE_NAMES.state },
      },
    },
    onAPIError: { errorURL: "/login" },
    databaseHooks: {
      account: {
        create: {
          before: async (account) => {
            // Immutable numeric GitHub ID only; usernames are never consulted (T-03).
            if (account.providerId !== "github" || !cfg.allowlist.has(String(account.accountId))) {
              throw new APIError("FORBIDDEN", { message: "not_allowlisted" });
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof buildAuth>;

export async function migrateAuth(auth: Auth): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

/**
 * Wraps auth.handler: every response is no-store; a denied OAuth callback becomes a
 * redirect to the login page instead of raw JSON (spike finding 3); a successful
 * sign-out clears site data (T-06).
 */
export async function handleAuthRequest(auth: Auth, cfg: OperatorAuthConfig, req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  let res = await auth.handler(req);
  if (req.method === "GET" && path.startsWith("/api/auth/callback/") && res.status === 403) {
    const location = new URL("/login?error=denied", cfg.publicUrl).toString();
    const headers = new Headers({ Location: location });
    for (const c of res.headers.getSetCookie()) headers.append("Set-Cookie", c); // keep state-cookie clearing
    res = new Response(null, { status: 302, headers });
  }
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "private, no-store");
  if (path === "/api/auth/sign-out" && res.status === 200) {
    out.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  }
  return out;
}
