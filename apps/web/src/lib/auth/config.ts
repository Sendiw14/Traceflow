// SPDX-License-Identifier: Apache-2.0
// Owner: Opus (ADR-0005). Pure configuration parsing — no I/O, safe to unit test.

import type { Profile } from "@/lib/profile";

export interface OperatorAuthConfig {
  publicUrl: string; // https origin the browser uses, e.g. https://traceflow.example
  secret: string; // >= 32 chars, signs cookies
  databaseUrl: string; // traceflow_auth role on the separate auth database
  githubClientId: string;
  githubClientSecret: string;
  allowlist: ReadonlySet<string>; // immutable numeric GitHub user IDs
}

export type AuthMode =
  | { kind: "bootstrap" } // local-dev only: fixed local operator, no OAuth
  | { kind: "none" } // public-demo: no auth subsystem
  | { kind: "github"; config: OperatorAuthConfig }
  | { kind: "misconfigured"; problems: string[] }; // operator-prod with bad env: fail closed

/** Sentinel actor for local-dev audit rows (consumer review C-1). Never valid outside local-dev. */
export const LOCAL_DEV_ACTOR = "0";

const NUMERIC_ID = /^[1-9][0-9]{0,19}$/;

export function parseAllowlist(raw: string | undefined): { ids: Set<string>; bad: string[] } {
  const ids = new Set<string>();
  const bad: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const v = part.trim();
    if (!v) continue;
    if (NUMERIC_ID.test(v)) ids.add(v);
    else bad.push(v);
  }
  return { ids, bad };
}

export function authMode(profile: Profile | null, env: Record<string, string | undefined>): AuthMode {
  if (profile === "local-dev") return { kind: "bootstrap" };
  if (profile !== "operator-prod") return { kind: "none" }; // public-demo or unknown: nothing to sign in to
  const problems: string[] = [];
  const req = (name: string) => {
    const v = env[name]?.trim();
    if (!v) problems.push(`${name} is required`);
    return v ?? "";
  };
  const publicUrl = req("TRACEFLOW_PUBLIC_URL");
  const secret = req("TRACEFLOW_AUTH_SECRET");
  const databaseUrl = req("TRACEFLOW_AUTH_DATABASE_URL");
  const githubClientId = req("GITHUB_CLIENT_ID");
  const githubClientSecret = req("GITHUB_CLIENT_SECRET");
  const { ids, bad } = parseAllowlist(env.TRACEFLOW_OPERATOR_GITHUB_IDS);
  if (publicUrl) {
    try {
      const u = new URL(publicUrl);
      if (u.protocol !== "https:") problems.push("TRACEFLOW_PUBLIC_URL must be https");
      if (u.pathname !== "/" || u.search || u.hash) problems.push("TRACEFLOW_PUBLIC_URL must be an origin without path");
    } catch {
      problems.push("TRACEFLOW_PUBLIC_URL is not a valid URL");
    }
  }
  if (secret && secret.length < 32) problems.push("TRACEFLOW_AUTH_SECRET must be at least 32 characters");
  if (bad.length) problems.push(`TRACEFLOW_OPERATOR_GITHUB_IDS has non-numeric entries (${bad.length})`);
  if (ids.size === 0) problems.push("TRACEFLOW_OPERATOR_GITHUB_IDS must list at least one numeric GitHub user ID");
  if (problems.length) return { kind: "misconfigured", problems };
  return {
    kind: "github",
    config: { publicUrl: new URL(publicUrl).origin, secret, databaseUrl, githubClientId, githubClientSecret, allowlist: ids },
  };
}

/** Session lifetime (ADR-0005 spike-derived requirements). */
export const SESSION_IDLE_SECONDS = 12 * 3600;
export const SESSION_UPDATE_AGE_SECONDS = 3600;
export const SESSION_ABSOLUTE_MS = 7 * 24 * 3600 * 1000;

export function sessionTooOld(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > SESSION_ABSOLUTE_MS;
}
