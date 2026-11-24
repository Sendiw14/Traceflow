import { afterEach, describe, expect, it, vi } from "vitest";

// Each layout and action must refuse a disallowed profile on its own, without proxy.ts.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/data", () => ({
  updateSettings: vi.fn(async () => { throw new Error("trace-api must not be called"); }),
  listTraces: vi.fn(async () => { throw new Error("trace-api must not be called"); }),
  getSpan: vi.fn(async () => { throw new Error("trace-api must not be called"); }),
}));

const TRACE = "0123456789abcdef0123456789abcdef";
const refused = async (fn: () => unknown) => {
  try { await fn(); } catch (e) { return String((e as { digest?: string }).digest ?? e); }
  return null;
};

afterEach(() => vi.unstubAllEnvs());

describe("layouts refuse without the proxy", () => {
  it("/app layout: public-demo, unset and unknown profiles → notFound; local-dev and operator-prod render", async () => {
    const { default: AppLayout } = await import("@/app/app/layout");
    for (const p of ["public-demo", "", "bogus"]) {
      vi.stubEnv("TRACEFLOW_PROFILE", p);
      expect(await refused(() => AppLayout({ children: null })), p).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    }
    for (const p of ["local-dev", "operator-prod"]) {
      vi.stubEnv("TRACEFLOW_PROFILE", p);
      expect(await refused(() => AppLayout({ children: null })), p).toBeNull();
    }
  });
  it("/demo layout: operator-prod, unset and unknown → notFound; local-dev and public-demo render", async () => {
    const { default: DemoLayout } = await import("@/app/demo/layout");
    for (const p of ["operator-prod", "", "bogus"]) {
      vi.stubEnv("TRACEFLOW_PROFILE", p);
      expect(await refused(() => DemoLayout({ children: null })), p).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    }
    for (const p of ["local-dev", "public-demo"]) {
      vi.stubEnv("TRACEFLOW_PROFILE", p);
      expect(await refused(() => DemoLayout({ children: null })), p).toBeNull();
    }
  });
});

describe("server actions refuse without the proxy and never reach trace-api", () => {
  it("updateRetention only under profiles that serve /app", async () => {
    const { updateRetention } = await import("@/app/app/settings/actions");
    for (const p of ["public-demo", "", "bogus"]) {
      vi.stubEnv("TRACEFLOW_PROFILE", p);
      expect(await updateRetention(7), p).toMatchObject({ ok: false, code: "forbidden" });
    }
  });
  it("loadMoreTraces and fetchSpan refuse when no area is served", async () => {
    const { loadMoreTraces } = await import("@/app/app/traces/actions");
    const { fetchSpan } = await import("@/app/app/traces/[traceId]/actions");
    for (const p of ["", "bogus"]) {
      vi.stubEnv("TRACEFLOW_PROFILE", p);
      expect(await loadMoreTraces({ from: "1", to: "2", status: "any" }, "c")).toMatchObject({ ok: false });
      expect(await fetchSpan(TRACE, "0123456789abcdef")).toMatchObject({ ok: false, message: "Not available in this deployment." });
    }
  });
});
