// SPDX-License-Identifier: Apache-2.0
// Owner: Opus (ADR-0005). The only module pages, layouts and server actions use for identity.
import "server-only";

import { headers as nextHeaders } from "next/headers";
import { Pool } from "pg";

import { currentProfile } from "@/lib/profile";
import { LOCAL_DEV_ACTOR, authMode, sessionTooOld, type AuthMode, type OperatorAuthConfig } from "./config";
import { buildAuth, migrateAuth, type Auth } from "./core";

export type Operator = { githubId: string; kind: "github" | "bootstrap" };

let instance: Promise<{ auth: Auth; pool: Pool }> | null = null;

/** Lazily builds the auth instance once per process and applies better-auth's migrations to the auth database. */
export function authInstance(cfg: OperatorAuthConfig): Promise<{ auth: Auth; pool: Pool }> {
  instance ??= (async () => {
    const pool = new Pool({ connectionString: cfg.databaseUrl, max: 5 });
    const auth = buildAuth(cfg, pool);
    await migrateAuth(auth);
    return { auth, pool };
  })().catch((err) => {
    instance = null; // retry on next request rather than caching a failure
    throw err;
  });
  return instance;
}

export function currentAuthMode(): AuthMode {
  return authMode(currentProfile(), process.env);
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

function loopbackHost(host: string | null): boolean {
  if (!host) return false;
  try {
    return LOOPBACK.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

/**
 * The signed-in operator, or null. Re-checks the allowlist and the 7-day absolute
 * session cap on every call, so removing an ID from the allowlist takes effect
 * immediately. local-dev bootstrap is honoured only for loopback Host headers.
 */
export async function getOperator(): Promise<Operator | null> {
  const mode = currentAuthMode();
  const h = await nextHeaders();
  if (mode.kind === "bootstrap") return loopbackHost(h.get("host")) ? { githubId: LOCAL_DEV_ACTOR, kind: "bootstrap" } : null;
  if (mode.kind !== "github") return null;

  const { auth, pool } = await authInstance(mode.config);
  const s = await auth.api.getSession({ headers: h });
  if (!s) return null;
  if (sessionTooOld(new Date(s.session.createdAt))) {
    await auth.api.revokeSession({ headers: h, body: { token: s.session.token } }).catch(() => undefined);
    return null;
  }
  const r = await pool.query<{ accountId: string }>(
    `SELECT "accountId" FROM account WHERE "userId" = $1 AND "providerId" = 'github' LIMIT 1`,
    [s.user.id],
  );
  const id = r.rows[0]?.accountId;
  if (!id || !mode.config.allowlist.has(String(id))) return null;
  return { githubId: String(id), kind: "github" };
}
