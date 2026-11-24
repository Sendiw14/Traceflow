import "server-only";
import { createTraceApiClient } from "@/lib/api/client";
import { requireAccess } from "./guard";
import type { components } from "@/lib/api/generated/schema";

export type Schemas = components["schemas"];

export interface ApiProblem {
  status: number;
  code: string;
  title: string;
  detail?: string;
  errors?: Schemas["Problem"]["errors"];
  retryAfter?: number;
}
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiProblem };

/** BFF boundary: env is read on the server only; the browser never sees the URL or token. */
export function api() {
  const url = process.env.TRACE_API_URL;
  const token = process.env.TRACEFLOW_SERVICE_TOKEN;
  if (!url || !token) return null;
  return createTraceApiClient(url, token);
}

const UNAUTHORIZED: ApiProblem = { status: 401, code: "unauthorized", title: "Sign-in required" };
const FORBIDDEN: ApiProblem = { status: 403, code: "forbidden", title: "Not available in this deployment" };
const NOT_CONFIGURED: ApiProblem = {
  status: 503, code: "storage_unavailable", title: "TRACEFLOW is not configured",
  detail: "TRACE_API_URL and TRACEFLOW_SERVICE_TOKEN must be set for the web service.",
};

interface Raw<T> { data?: T; error?: unknown; response: Response }

/** Normalises openapi-fetch results and network failures into Result<T>; never throws. */
export async function call<T>(fn: (c: NonNullable<ReturnType<typeof api>>) => Promise<Raw<T>>): Promise<Result<T>> {
  // Backstop for layouts (which do not re-run on client navigation): no operator, no data. Shared reads stay open in public-demo.
  const access = await requireAccess(null);
  if (!access.ok) return { ok: false, error: access.code === "unauthorized" ? UNAUTHORIZED : FORBIDDEN };
  const c = api();
  if (!c) return { ok: false, error: NOT_CONFIGURED };
  try {
    const r = await fn(c);
    if (r.data !== undefined && r.response.ok) return { ok: true, data: r.data };
    return { ok: false, error: toProblem(r.error, r.response) };
  } catch {
    return { ok: false, error: { status: 503, code: "storage_unavailable", title: "TRACEFLOW cannot reach its API", detail: "The trace API did not respond." } };
  }
}

export function toProblem(body: unknown, response: Response): ApiProblem {
  const p = (body && typeof body === "object" ? body : {}) as Partial<Schemas["Problem"]>;
  const ra = Number(response.headers.get("Retry-After"));
  return {
    status: response.status,
    code: typeof p.code === "string" ? p.code : response.status === 404 ? "not_found" : "internal",
    title: typeof p.title === "string" ? p.title : response.statusText || "Request failed",
    detail: typeof p.detail === "string" ? p.detail : undefined,
    errors: p.errors,
    retryAfter: Number.isFinite(ra) && ra > 0 ? ra : undefined,
  };
}

const ns = (v: bigint) => v.toString();

export const getOverview = (from: bigint, to: bigint, service?: string) =>
  call((c) => c.GET("/v1/overview", { params: { query: { from: ns(from), to: ns(to), service } } }));
export const getServerLatency = (q: { from: bigint; to: bigint; bucketSeconds: number; service?: string; operation?: string }) =>
  call((c) => c.GET("/v1/analytics/server-latency", { params: { query: { from: ns(q.from), to: ns(q.to), bucket_seconds: q.bucketSeconds as never, service: q.service, operation: q.operation } } }));
export const getLatencyDistribution = (q: { from: bigint; to: bigint; service?: string; operation?: string }) =>
  call((c) => c.GET("/v1/analytics/latency-distribution", { params: { query: { from: ns(q.from), to: ns(q.to), service: q.service, operation: q.operation } } }));
export const getIngestionStatus = (from: bigint, to: bigint) =>
  call((c) => c.GET("/v1/ingestion/status", { params: { query: { from: ns(from), to: ns(to) } } }));
export const listServices = (from: bigint, to: bigint) =>
  call((c) => c.GET("/v1/services", { params: { query: { from: ns(from), to: ns(to) } } }));
export const getService = (name: string, from: bigint, to: bigint) =>
  call((c) => c.GET("/v1/services/{serviceName}", { params: { path: { serviceName: name }, query: { from: ns(from), to: ns(to) } } }));
export const getDependencies = (from: bigint, to: bigint) =>
  call((c) => c.GET("/v1/dependencies", { params: { query: { from: ns(from), to: ns(to) } } }));
export const getSettings = () => call((c) => c.GET("/v1/settings"));
export const getTrace = (traceId: string, detail: "full" | "lite") =>
  call((c) => c.GET("/v1/traces/{traceId}", { params: { path: { traceId }, query: { detail } } }));
export const getSpan = (traceId: string, spanId: string) =>
  call((c) => c.GET("/v1/traces/{traceId}/spans/{spanId}", { params: { path: { traceId, spanId } } }));
export const listTraces = (q: { from: bigint; to: bigint; service?: string; status?: "any" | "error" | "ok_or_unset"; minDurationNano?: bigint; cursor?: string; limit?: number }) =>
  call((c) => c.GET("/v1/traces", { params: { query: { from: ns(q.from), to: ns(q.to), service: q.service, status: q.status, min_duration_nano: q.minDurationNano === undefined ? undefined : ns(q.minDurationNano), cursor: q.cursor, limit: q.limit } } }));

/** `actor` is the signed-in operator's numeric GitHub ID (bootstrap: "0") — never taken from the request. */
export const updateSettings = (body: Schemas["SettingsPatch"], actor: string) =>
  call((c) => c.PATCH("/v1/settings", { params: { header: { "X-Traceflow-Actor": actor } }, body }));
