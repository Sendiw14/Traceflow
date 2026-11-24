// SPDX-License-Identifier: Apache-2.0
// Owner: Opus. Production auth wiring (core.ts) against real PostgreSQL and a mocked GitHub.
// Needs TRACEFLOW_TEST_AUTH_DATABASE_URL pointing at a disposable database; skipped otherwise.
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { OperatorAuthConfig } from "./config";
import { COOKIE_NAMES, buildAuth, handleAuthRequest, migrateAuth, type Auth } from "./core";

const DB = process.env.TRACEFLOW_TEST_AUTH_DATABASE_URL;
if (process.env.TRACEFLOW_REQUIRE_AUTH_DB === "1" && !DB) {
  throw new Error("TRACEFLOW_REQUIRE_AUTH_DB=1 but TRACEFLOW_TEST_AUTH_DATABASE_URL is unset: the auth suite must not be skipped");
}
const ORIGIN = "https://traceflow.test";

const cfg: OperatorAuthConfig = {
  publicUrl: ORIGIN,
  secret: "s".repeat(48), // gitleaks:allow test-only secret
  databaseUrl: DB ?? "",
  githubClientId: "test-client",
  githubClientSecret: "test-secret", // gitleaks:allow test-only value
  allowlist: new Set(["1001"]),
};

let ghUser = { id: 1001, login: "alice", name: "Alice", email: "alice@example.test", avatar_url: "" };
const tokenRequests: string[] = [];

const realFetch = globalThis.fetch;
function mockGitHub() {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!/^https:\/\/(github\.com|api\.github\.com)\//.test(url)) return realFetch(input, init);
    const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
    if (url.startsWith("https://github.com/login/oauth/access_token")) {
      tokenRequests.push(init?.body ? String(init.body) : input instanceof Request ? await input.clone().text() : "");
      return json({ access_token: "mock", token_type: "bearer", scope: "read:user,user:email" });
    }
    if (url === "https://api.github.com/user") return json(ghUser);
    if (url === "https://api.github.com/user/emails") return json([{ email: ghUser.email, primary: true, verified: true }]);
    return new Response("not mocked", { status: 500 });
  });
}

const jar = new Map<string, string>();
function store(res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const pair = c.split(";")[0] ?? "";
    const i = pair.indexOf("=");
    const k = pair.slice(0, i);
    const v = pair.slice(i + 1);
    if (!v || /max-age=0/i.test(c)) jar.delete(k);
    else jar.set(k, v);
  }
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

let auth: Auth;
let pool: Pool;
const call = async (path: string, init: { method?: string; body?: unknown; origin?: string | null } = {}) => {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.origin !== null) headers.origin = init.origin ?? ORIGIN;
  if (jar.size) headers.cookie = cookieHeader();
  const res = await handleAuthRequest(auth, cfg, new Request(ORIGIN + path, {
    method: init.method ?? "GET", headers, redirect: "manual",
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  }));
  return res;
};
const count = async (table: string) => (await pool.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n as number;

async function startLogin(callbackURL = "/app") {
  jar.clear();
  const res = await call("/api/auth/sign-in/social", { method: "POST", body: { provider: "github", callbackURL } });
  store(res);
  return res;
}
async function login(code = "c") {
  const start = await startLogin();
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state")!;
  const res = await call(`/api/auth/callback/github?code=${code}&state=${encodeURIComponent(state)}`);
  store(res);
  return res;
}

describe.skipIf(!DB)("auth core (real PostgreSQL, mocked GitHub)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DB });
    for (const t of ["verification", "session", "account", "user"]) await pool.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    auth = buildAuth(cfg, pool);
    await migrateAuth(auth);
    mockGitHub();
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await pool.end();
  });
  beforeEach(() => {
    ghUser = { id: 1001, login: "alice", name: "Alice", email: "alice@example.test", avatar_url: "" };
  });

  it("authorization request: state, PKCE S256, own redirect_uri, __Host- state cookie", async () => {
    const res = await startLogin();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const u = new URL(((await res.json()) as { url: string }).url);
    expect(u.searchParams.get("state")?.length).toBeGreaterThanOrEqual(32);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback/github`);
    const sc = res.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_NAMES.state}=`)) ?? "";
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/Secure/i);
    expect(sc).toMatch(/SameSite=Lax/i);
    expect(sc).toMatch(/Path=\//);
    expect(sc).not.toMatch(/Domain=/i);
  });

  it("rejects an external callbackURL (open redirect)", async () => {
    const res = await startLogin("https://evil.example/steal");
    expect([400, 403]).toContain(res.status);
  });

  it("wrong state: no session, redirected to the login error page", async () => {
    await startLogin();
    const before = await count("session");
    const res = await call("/api/auth/callback/github?code=x&state=WRONG");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login");
    expect(await count("session")).toBe(before);
  });

  it("allowlisted numeric ID: PKCE verifier sent, __Host- session cookie, redirect to callbackURL", async () => {
    tokenRequests.length = 0;
    const res = await login();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/app");
    expect(tokenRequests.some((b) => b.includes("code_verifier="))).toBe(true);
    const sc = res.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_NAMES.session}=`)) ?? "";
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/Secure/i);
    expect(sc).toMatch(/SameSite=Lax/i);
    expect(sc).toMatch(/Path=\//);
    expect(sc).not.toMatch(/Domain=/i);
    expect(sc).toMatch(/Max-Age=43200/); // 12 h idle
    const acct = await pool.query(`SELECT "accountId" FROM account WHERE "providerId" = 'github'`);
    expect(acct.rows.map((r) => r.accountId)).toContain("1001");
  });

  it("non-allowlisted ID: redirect to /login?error=denied, no user, account or session rows", async () => {
    ghUser = { id: 2002, login: "mallory", name: "M", email: "mallory@example.test", avatar_url: "" };
    const [u0, s0] = [await count("user"), await count("session")];
    const res = await login("bad");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=denied`);
    expect(await count("user")).toBe(u0);
    expect(await count("session")).toBe(s0);
    expect((await pool.query(`SELECT 1 FROM account WHERE "accountId" = '2002'`)).rowCount).toBe(0);
  });

  it("renamed GitHub login with the same numeric ID is still allowed", async () => {
    ghUser = { ...ghUser, login: "alice-renamed" };
    const res = await login("r");
    expect(res.headers.get("location")).toBe("/app");
  });

  it("sign-out: cross-origin refused; same-origin deletes the session and clears site data", async () => {
    await login("so");
    const token = jar.get(COOKIE_NAMES.session);
    const n0 = await count("session");
    const evil = await call("/api/auth/sign-out", { method: "POST", body: {}, origin: "https://evil.example" });
    expect(evil.status).toBe(403);
    expect(await count("session")).toBe(n0);
    const ok = await call("/api/auth/sign-out", { method: "POST", body: {} });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("clear-site-data")).toContain('"cookies"');
    expect(await count("session")).toBe(n0 - 1);
    jar.set(COOKIE_NAMES.session, token!);
    const s = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader() }) });
    expect(s).toBeNull();
  });

  it("account linking is disabled (no path around the allowlist)", () => {
    expect(auth.options.account?.accountLinking?.enabled).toBe(false);
  });
});
