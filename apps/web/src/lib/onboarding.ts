// Onboarding helpers (pure, tested): reject-reason advice, connection state.
import type { Schemas } from "@/lib/server/data";

const ADVICE: Record<string, string> = {
  invalid_id: "A span had an invalid trace or span ID (all-zero or wrong length). Check the instrumentation library version.",
  invalid_timestamp: "A span had an invalid or out-of-range timestamp. Check the clock on the emitting host.",
  invalid_span: "A span failed validation (for example an empty name or malformed field).",
  conflicting_replay: "The same span ID was received again with different content. This usually means ID reuse or a misbehaving exporter.",
  trace_span_limit: "A trace exceeded the per-trace span limit; extra spans are dropped. See Settings → limits.",
};

export function rejectAdvice(reason: string): string {
  return ADVICE[reason] ?? "Spans were rejected for a reason this version does not recognise.";
}

export type Connection =
  | { kind: "waiting" }
  | { kind: "connected"; accepted: number; at: string | null }
  | { kind: "quiet"; firstAt: string };

export function connectionState(s: Schemas["IngestionStatus"]): Connection {
  if (s.first_span_received_at === null) return { kind: "waiting" };
  if (s.spans_accepted > 0) return { kind: "connected", accepted: s.spans_accepted, at: s.last_request_at ?? null };
  return { kind: "quiet", firstAt: s.first_span_received_at };
}

/** HTTP status keys that are not 2xx, with counts, sorted by status. */
export function failedRequests(requests: Record<string, number>): [string, number][] {
  return Object.entries(requests).filter(([k, v]) => !k.startsWith("2") && v > 0).sort(([a], [b]) => a.localeCompare(b));
}
