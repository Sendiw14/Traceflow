"use server";

import { requireAccess } from "@/lib/server/guard";
import { isSpanId, isTraceId } from "@/lib/query/params";
import { getSpan, type Schemas } from "@/lib/server/data";

export type SpanResult = { ok: true; detail: Schemas["SpanDetail"] } | { ok: false; message: string; unauthorized?: boolean };

/** Server Action for lite-mode inspector: trace-api stays server-side. Input is untrusted. */
export async function fetchSpan(traceId: string, spanId: string): Promise<SpanResult> {
  const access = await requireAccess(null);
  if (!access.ok) return { ok: false, message: access.code === "unauthorized" ? "Your session expired. Sign in again." : "Not available in this deployment.", unauthorized: access.code === "unauthorized" };
  if (typeof traceId !== "string" || typeof spanId !== "string" || !isTraceId(traceId) || !isSpanId(spanId)) {
    return { ok: false, message: "Invalid span reference." };
  }
  const r = await getSpan(traceId, spanId);
  if (!r.ok) return { ok: false, message: r.error.code === "not_found" ? "Span not found in this trace." : (r.error.detail ?? r.error.title) };
  return { ok: true, detail: r.data };
}
