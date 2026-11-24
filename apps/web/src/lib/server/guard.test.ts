import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-tf-path": "/app/traces?range=6h" }) }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
const getOperator = vi.fn();
const currentAuthMode = vi.fn();
vi.mock("@/lib/auth/server", () => ({ getOperator: (...a: unknown[]) => getOperator(...a), currentAuthMode: () => currentAuthMode() }));
const fetchSpy = vi.fn();

const GITHUB = { kind: "github" } as const;
const TRACE = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  getOperator.mockReset();
  currentAuthMode.mockReset();
  fetchSpy.mockReset().mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("TRACE_API_URL", "http://trace-api.invalid");
  vi.stubEnv("TRACEFLOW_SERVICE_TOKEN", "t".repeat(64));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("requireAccess", () => {
  it("operator-prod: refuses without an operator, and when the auth backend throws (fail closed)", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "operator-prod");
    currentAuthMode.mockReturnValue(GITHUB);
    const { requireAccess } = await import("./guard");
    getOperator.mockResolvedValue(null);
    expect(await requireAccess("app")).toEqual({ ok: false, code: "unauthorized" });
    getOperator.mockRejectedValue(new Error("auth db unreachable"));
    expect(await requireAccess(null)).toEqual({ ok: false, code: "unauthorized" });
  });
  it("operator-prod: allows a signed-in operator", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "operator-prod");
    currentAuthMode.mockReturnValue(GITHUB);
    getOperator.mockResolvedValue({ githubId: "12345", kind: "github" });
    const { requireAccess } = await import("./guard");
    expect(await requireAccess("app")).toEqual({ ok: true, operator: { githubId: "12345", kind: "github" } });
  });
  it("public-demo: shared reads stay unauthenticated, /app actions are forbidden", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "public-demo");
    currentAuthMode.mockReturnValue({ kind: "none" });
    const { requireAccess } = await import("./guard");
    expect(await requireAccess(null)).toEqual({ ok: true, operator: null });
    expect(await requireAccess("app")).toEqual({ ok: false, code: "forbidden" });
    expect(getOperator).not.toHaveBeenCalled();
  });
  it("unset profile: forbidden before any identity lookup", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "");
    const { requireAccess } = await import("./guard");
    expect(await requireAccess(null)).toEqual({ ok: false, code: "forbidden" });
    expect(getOperator).not.toHaveBeenCalled();
  });
});

describe("server actions and data access refuse without an operator", () => {
  it("updateRetention: unauthorized in operator-prod without operator; never calls trace-api", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "operator-prod");
    currentAuthMode.mockReturnValue(GITHUB);
    getOperator.mockResolvedValue(null);
    const { updateRetention } = await import("@/app/app/settings/actions");
    expect(await updateRetention(7)).toMatchObject({ ok: false, code: "unauthorized" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("updateRetention: sends the operator's GitHub ID as X-Traceflow-Actor", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "operator-prod");
    currentAuthMode.mockReturnValue(GITHUB);
    getOperator.mockResolvedValue({ githubId: "424242", kind: "github" });
    const { updateRetention } = await import("@/app/app/settings/actions");
    await updateRetention(7);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const req = fetchSpy.mock.calls[0]![0] as Request;
    expect(req.headers.get("X-Traceflow-Actor")).toBe("424242");
    expect(req.method).toBe("PATCH");
  });
  it("shared read actions flag unauthorized in operator-prod and stay open in public-demo", async () => {
    const { loadMoreTraces } = await import("@/app/app/traces/actions");
    const { fetchSpan } = await import("@/app/app/traces/[traceId]/actions");
    vi.stubEnv("TRACEFLOW_PROFILE", "operator-prod");
    currentAuthMode.mockReturnValue(GITHUB);
    getOperator.mockResolvedValue(null);
    expect(await loadMoreTraces({ from: "1", to: "2", status: "any" }, "c")).toMatchObject({ ok: false, unauthorized: true });
    expect(await fetchSpan(TRACE, "0123456789abcdef")).toMatchObject({ ok: false, unauthorized: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.stubEnv("TRACEFLOW_PROFILE", "public-demo");
    currentAuthMode.mockReturnValue({ kind: "none" });
    await fetchSpan(TRACE, "0123456789abcdef");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
  it("data layer: no operator → redirect to /login (path kept), and trace-api is never contacted", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "operator-prod");
    currentAuthMode.mockReturnValue(GITHUB);
    getOperator.mockResolvedValue(null); // e.g. session expired or removed from the allowlist
    const d = await import("./data");
    const calls = [
      () => d.getOverview(1n, 2n), () => d.listTraces({ from: 1n, to: 2n }), () => d.getTrace(TRACE, "full"), () => d.getSpan(TRACE, "0123456789abcdef"),
      () => d.listServices(1n, 2n), () => d.getService("orders", 1n, 2n), () => d.getDependencies(1n, 2n), () => d.getSettings(),
      () => d.getIngestionStatus(1n, 2n), () => d.getServerLatency({ from: 1n, to: 2n, bucketSeconds: 60 }), () => d.getLatencyDistribution({ from: 1n, to: 2n }),
    ];
    for (const fn of calls) {
      const err = await fn().then(() => null, (e: { digest?: string }) => e);
      expect(String(err?.digest), fn.toString()).toMatch(/^NEXT_REDIRECT;replace;\/login\?next=%2Fapp%2Ftraces%3Frange%3D6h&reason=expired;/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("data layer: auth backend failure also redirects (fail closed); disallowed profile is a 404", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "operator-prod");
    currentAuthMode.mockReturnValue(GITHUB);
    getOperator.mockRejectedValue(new Error("auth db unreachable"));
    const d = await import("./data");
    expect(String(((await d.getOverview(1n, 2n).then(() => null, (e) => e)) as { digest?: string }).digest)).toMatch(/^NEXT_REDIRECT/);
    vi.stubEnv("TRACEFLOW_PROFILE", "");
    expect(String(((await d.getOverview(1n, 2n).then(() => null, (e) => e)) as { digest?: string }).digest)).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("data layer: a signed-in operator reaches trace-api", async () => {
    vi.stubEnv("TRACEFLOW_PROFILE", "operator-prod");
    currentAuthMode.mockReturnValue(GITHUB);
    getOperator.mockResolvedValue({ githubId: "1", kind: "github" });
    const { getOverview } = await import("./data");
    await getOverview(1n, 2n);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
