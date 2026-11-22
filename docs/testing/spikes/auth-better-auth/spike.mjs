// Throwaway spike for ADR-0005 (better-auth 1.7.27). Not product code.
// Run: docker run -d --name tf-auth-spike -e POSTGRES_PASSWORD=spike -p 127.0.0.1:<port>:5432 postgres:18.7
//      docker exec tf-auth-spike psql -U postgres -c "create schema auth;"
//      npm ci && SPIKE_PG_PORT=<port> node spike.mjs
// Exercises the GitHub OAuth flow end to end against a mocked GitHub (fetch interception),
// a real PostgreSQL `auth` schema, and better-auth's own request handler.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";

const PORT = process.env.SPIKE_PG_PORT ?? readFileSync(new URL("../pgport", import.meta.url), "utf8").trim();
const ORIGIN = "https://traceflow.test";
const ALLOW = new Set(["1001"]); // test numeric GitHub IDs only
const pool = new pg.Pool({ connectionString: `postgres://postgres:spike@127.0.0.1:${PORT}/postgres`, options: "-c search_path=auth" });

// ---- mocked GitHub ------------------------------------------------------------------
let ghUser = { id: 1001, login: "alice", name: "Alice", email: "alice@example.test", avatar_url: "" };
const seen = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!/^https:\/\/(github\.com|api\.github\.com)\//.test(url)) return realFetch(input, init);
  seen.push({ url, body: init?.body ? String(init.body) : (input instanceof Request ? await input.clone().text() : "") });
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://github.com/login/oauth/access_token")) return json({ access_token: "gho_test", // gitleaks:allow mock token
    token_type: "bearer", scope: "read:user,user:email" });
  if (url === "https://api.github.com/user") return json(ghUser);
  if (url === "https://api.github.com/user/emails") return json([{ email: ghUser.email, primary: true, verified: true }]);
  return new Response("not mocked", { status: 500 });
};

// ---- auth instance (as ADR-0005 proposes) --------------------------------------------
const auth = betterAuth({
  baseURL: ORIGIN,
  secret: randomBytes(32).toString("hex"),
  database: pool,
  trustedOrigins: [ORIGIN],
  socialProviders: { github: { clientId: "test-client", clientSecret: "test-secret" } },
  session: { expiresIn: 7 * 24 * 3600, updateAge: 12 * 3600 },
  advanced: { useSecureCookies: false, defaultCookieAttributes: { secure: true, httpOnly: true, sameSite: "lax", path: "/" }, cookies: { session_token: { name: "__Host-tf_session" }, session_data: { name: "__Host-tf_session_data" }, state: { name: "__Host-tf_state" } } },
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          if (account.providerId !== "github" || !ALLOW.has(String(account.accountId))) {
            throw new APIError("FORBIDDEN", { message: "not on operator allowlist" });
          }
        },
      },
    },
  },
});

const { runMigrations } = await getMigrations(auth.options);
await runMigrations();

// ---- helpers ------------------------------------------------------------------------
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok: !!ok, detail }); };
const jar = new Map();
const store = (res) => {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const [k, ...v] = pair.split("=");
    if (v.join("=") === "" || /max-age=0/i.test(c)) jar.delete(k); else jar.set(k, v.join("="));
  }
};
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const req = (path, { method = "GET", body, origin = ORIGIN, cookies = true } = {}) =>
  auth.handler(new Request(ORIGIN + path, {
    method,
    redirect: "manual",
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(origin ? { origin } : {}), ...(cookies && jar.size ? { cookie: cookieHeader() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }));
const q = async (sql) => (await pool.query(sql)).rows;

async function startLogin(callbackURL = "/app") {
  jar.clear();
  const res = await req("/api/auth/sign-in/social", { method: "POST", body: { provider: "github", callbackURL } });
  store(res);
  return { res, data: res.ok ? await res.json() : await res.text(), setCookies: res.headers.getSetCookie() };
}

// T1: authorization request carries state (+PKCE?) and sets a state cookie
{
  const { res, data, setCookies } = await startLogin();
  const u = new URL(data.url);
  check("T1 start 200", res.status === 200, res.status);
  check("T1 state param", !!u.searchParams.get("state"), u.searchParams.get("state")?.length);
  check("T1 PKCE code_challenge S256", u.searchParams.get("code_challenge_method") === "S256", u.searchParams.get("code_challenge_method"));
  check("T1 redirect_uri is our callback", u.searchParams.get("redirect_uri") === ORIGIN + "/api/auth/callback/github", u.searchParams.get("redirect_uri"));
  check("T1 state cookie HttpOnly+Secure+SameSite=Lax", setCookies.some((c) => /tf_state/i.test(c) && /HttpOnly/i.test(c) && /Secure/i.test(c) && /SameSite=Lax/i.test(c)), setCookies.map((c) => c.split(";")[0].split("=")[0]));
}

// T2: open redirect — external callbackURL rejected
{
  const { res } = await startLogin("https://evil.example/steal");
  check("T2 external callbackURL rejected", res.status === 403 || res.status === 400, res.status);
}

// T3: callback with wrong state → no session
{
  const { data } = await startLogin();
  const res = await req(`/api/auth/callback/github?code=c&state=WRONG${data.url ? "" : ""}`);
  store(res);
  const sessions = await q("select count(*)::int n from session");
  check("T3 wrong state no session", sessions[0].n === 0, { status: res.status, location: res.headers.get("location") });
}

// T4: allowlisted numeric ID → session; cookie attributes
let sessionCookieName;
{
  ghUser = { ...ghUser, id: 1001, login: "alice" };
  const { data } = await startLogin();
  const state = new URL(data.url).searchParams.get("state");
  const res = await req(`/api/auth/callback/github?code=good&state=${encodeURIComponent(state)}`);
  const sc = res.headers.getSetCookie();
  store(res);
  const tokenReq = seen.find((s) => s.url.startsWith("https://github.com/login/oauth/access_token"));
  check("T4 token request sends code_verifier", /code_verifier=/.test(tokenReq?.body ?? ""), tokenReq ? "sent" : "no token request");
  check("T4 redirect to callbackURL", res.status === 302 && res.headers.get("location") === "/app", { status: res.status, location: res.headers.get("location") });
  const sess = sc.find((c) => /tf_session=/.test(c));
  sessionCookieName = sess?.split("=")[0];
  check("T4 session cookie HttpOnly", /HttpOnly/i.test(sess ?? ""), sessionCookieName);
  check("T4 session cookie Secure", /Secure/i.test(sess ?? ""), "");
  check("T4 session cookie SameSite=Lax", /SameSite=Lax/i.test(sess ?? ""), "");
  check("T4 session cookie __Host- prefix (ADR asks)", /^__Host-/.test(sessionCookieName ?? ""), sessionCookieName);
  const acct = await q(`select "accountId" as account_id, "providerId" as provider_id from account`);
  check("T4 stored accountId is numeric GitHub id", acct.length === 1 && acct[0].account_id === "1001", acct);
  const s = await (await req("/api/auth/get-session")).json();
  check("T4 get-session returns user", s?.user?.email === "alice@example.test", s?.user?.email);
}

// T5: second login creates a new session token (no fixation / reuse)
{
  const before = jar.get(sessionCookieName);
  const { data } = await startLogin();
  const state = new URL(data.url).searchParams.get("state");
  const res = await req(`/api/auth/callback/github?code=good2&state=${encodeURIComponent(state)}`);
  store(res);
  check("T5 new session token on re-login", jar.get(sessionCookieName) && jar.get(sessionCookieName) !== before, "");
}

// T6: sign-out — cross-origin rejected, same-origin deletes server session
{
  const tokenBefore = jar.get(sessionCookieName);
  const n0 = (await q("select count(*)::int n from session"))[0].n;
  const bad = await req("/api/auth/sign-out", { method: "POST", body: {}, origin: "https://evil.example" });
  const n1 = (await q("select count(*)::int n from session"))[0].n;
  check("T6 cross-origin sign-out rejected", bad.status === 403 && n1 === n0, { status: bad.status, n0, n1 });
  const ok = await req("/api/auth/sign-out", { method: "POST", body: {} });
  store(ok);
  const n2 = (await q("select count(*)::int n from session"))[0].n;
  check("T6 same-origin sign-out deletes a session row", ok.status === 200 && n2 === n1 - 1, { status: ok.status, n1, n2 });
  // replay old token after logout
  jar.set(sessionCookieName, tokenBefore);
  const s = await (await req("/api/auth/get-session")).json();
  check("T6 old token invalid after logout", s === null, s);
}

// T7: non-allowlisted numeric ID → denied, no user/session/account created
{
  ghUser = { id: 2002, login: "mallory", name: "M", email: "mallory@example.test", avatar_url: "" };
  const users0 = (await q("select count(*)::int n from \"user\""))[0].n;
  const sess0 = (await q("select count(*)::int n from session"))[0].n;
  const { data } = await startLogin();
  const state = new URL(data.url).searchParams.get("state");
  const res = await req(`/api/auth/callback/github?code=bad&state=${encodeURIComponent(state)}`);
  store(res);
  const users1 = (await q("select count(*)::int n from \"user\""))[0].n;
  const sess1 = (await q("select count(*)::int n from session"))[0].n;
  const acct = await q(`select "accountId" from account where "accountId" = '2002'`);
  check("T7 denied: no account row", acct.length === 0, acct);
  check("T7 denied: no session row", sess1 === sess0, { sess0, sess1 });
  check("T7 denied: no orphan user row", users1 === users0, { users0, users1, location: res.headers.get("location") });
}

// T8: username change does not bypass allowlist (same numeric id, new login)
{
  ghUser = { id: 1001, login: "alice-renamed", name: "Alice", email: "alice@example.test", avatar_url: "" };
  const { data } = await startLogin();
  const state = new URL(data.url).searchParams.get("state");
  const res = await req(`/api/auth/callback/github?code=r&state=${encodeURIComponent(state)}`);
  check("T8 renamed login, same id → allowed", res.status === 302 && res.headers.get("location") === "/app", res.headers.get("location"));
}

const tables = (await q("select table_name from information_schema.tables where table_schema='auth' order by 1")).map((r) => r.table_name);
check("schema: tables live in `auth` schema", tables.includes("session") && tables.includes("account"), tables);

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}  ${JSON.stringify(r.detail ?? "")}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
await pool.end();
