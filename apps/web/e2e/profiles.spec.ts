import { expect, test } from "@playwright/test";

// Profile gating is enforced server-side (src/proxy.ts); these servers are started by e2e/serve.sh.
const URLS = {
  "local-dev": process.env.E2E_URL_LOCAL_DEV ?? "http://127.0.0.1:3100",
  "public-demo": process.env.E2E_URL_PUBLIC_DEMO ?? "http://127.0.0.1:3101",
  "operator-prod": process.env.E2E_URL_OPERATOR_PROD ?? "http://127.0.0.1:3102",
  unset: process.env.E2E_URL_PROFILE_UNSET ?? "http://127.0.0.1:3103",
  bogus: process.env.E2E_URL_PROFILE_BOGUS ?? "http://127.0.0.1:3104",
} as const;
const TRACE = "0123456789abcdef0123456789abcdef";
const APP = ["/app", "/app/traces", `/app/traces/${TRACE}`, "/app/services", "/app/map", "/app/analytics", "/app/onboarding", "/app/settings"];
const DEMO = ["/demo", `/demo/traces/${TRACE}`];
const LOGIN = ["/login", "/login?error=denied"];

async function status(request: import("@playwright/test").APIRequestContext, base: string, path: string) {
  return (await request.get(`${base}${path}`)).status();
}

test("public-demo: every /app route is 404, public routes stay up", async ({ request }) => {
  for (const p of APP) expect(await status(request, URLS["public-demo"], p), p).toBe(404);
  for (const p of ["/", "/docs", "/demo"]) expect(await status(request, URLS["public-demo"], p), p).toBe(200);
});

test("operator-prod: every /demo route is 404; /app needs sign-in (redirect), site stays up", async ({ request }) => {
  const b = URLS["operator-prod"];
  for (const p of DEMO) expect(await status(request, b, p), p).toBe(404);
  const res = await request.get(`${b}/app`, { maxRedirects: 0 });
  expect([302, 307]).toContain(res.status());
  expect(res.headers()["location"]).toMatch(/\/login\?next=%2Fapp$/);
  expect(await status(request, b, "/")).toBe(200);
});

test("local-dev: /app and /demo are both on", async ({ request }) => {
  expect(await status(request, URLS["local-dev"], "/app")).toBe(200);
  expect(await status(request, URLS["local-dev"], "/demo")).toBe(200);
});

for (const kind of ["unset", "bogus"] as const) {
  test(`profile ${kind}: fails closed, /app and /demo are both 404`, async ({ request }) => {
    for (const p of [...APP, ...DEMO]) expect(await status(request, URLS[kind], p), p).toBe(404);
    expect(await status(request, URLS[kind], "/")).toBe(200);
  });
}

test("a gated 404 does not leak whether the route would exist", async ({ request }) => {
  const a = await request.get(`${URLS["public-demo"]}/app/settings`);
  const b = await request.get(`${URLS["public-demo"]}/app/definitely-not-a-route`);
  expect(a.status()).toBe(404);
  expect(await a.text()).toBe(await b.text());
});

test("second layer: layouts still 404 when the proxy is skipped via the subrequest header", async ({ request }) => {
  const headers = { "x-middleware-subrequest": ["middleware", "proxy", "src/middleware", "src/proxy"].join(":").repeat(1) + ":middleware:middleware:middleware:middleware:middleware" };
  for (const p of ["/app", "/app/settings", `/app/traces/${TRACE}`]) expect((await request.get(`${URLS["public-demo"]}${p}`, { headers })).status(), p).toBe(404);
  for (const p of DEMO) expect((await request.get(`${URLS["operator-prod"]}${p}`, { headers })).status(), p).toBe(404);
  for (const p of [...APP, ...DEMO]) expect((await request.get(`${URLS.bogus}${p}`, { headers })).status(), p).toBe(404);
});

test("/login is 404 outside operator-prod", async ({ request }) => {
  for (const base of [URLS["local-dev"], URLS["public-demo"], URLS.unset, URLS.bogus]) {
    for (const p of LOGIN) expect(await status(request, base, p), `${base}${p}`).toBe(404);
  }
  for (const p of LOGIN) expect(await status(request, URLS["operator-prod"], p), p).toBe(200);
});
