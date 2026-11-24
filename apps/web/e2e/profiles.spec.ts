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

async function status(request: import("@playwright/test").APIRequestContext, base: string, path: string) {
  return (await request.get(`${base}${path}`)).status();
}

test("public-demo: every /app route is 404, public routes stay up", async ({ request }) => {
  for (const p of APP) expect(await status(request, URLS["public-demo"], p), p).toBe(404);
  expect(await status(request, URLS["public-demo"], "/")).toBe(200);
});

test("operator-prod: every /demo route is 404, /app stays up", async ({ request }) => {
  for (const p of DEMO) expect(await status(request, URLS["operator-prod"], p), p).toBe(404);
  expect(await status(request, URLS["operator-prod"], "/app")).toBe(200);
  expect(await status(request, URLS["operator-prod"], "/")).toBe(200);
});

test("local-dev: /app is on", async ({ request }) => {
  expect(await status(request, URLS["local-dev"], "/app")).toBe(200);
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
