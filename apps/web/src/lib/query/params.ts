// Validation of URL search params into API query values. Invalid values fall back to defaults and are reported.
import type { Window } from "@/lib/time/window";
import { resolveWindow } from "@/lib/time/window";

export type SearchParams = Record<string, string | string[] | undefined>;

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export const STATUSES = ["any", "error", "ok_or_unset"] as const;
export type Status = (typeof STATUSES)[number];

const UNIT_NS: Record<string, bigint> = { us: 1_000n, ms: 1_000_000n, s: 1_000_000_000n };
const MIN_DURATION = /^([0-9]{1,9})(us|ms|s)$/;

/** `250ms` → 250000000n; undefined when absent or invalid. */
export function parseMinDuration(v: string | undefined): bigint | undefined {
  const m = v === undefined ? null : MIN_DURATION.exec(v);
  if (!m) return undefined;
  return BigInt(m[1]!) * UNIT_NS[m[2]!]!;
}

export interface TraceFilters {
  window: Window;
  service?: string;
  status: Status;
  minDuration?: string; // raw URL form, e.g. "250ms"
  notices: string[];
}

export function parseTraceFilters(sp: SearchParams, nowMs?: number): TraceFilters {
  const notices: string[] = [];
  const window = resolveWindow(first(sp.range), nowMs);
  if (window.notice) notices.push(window.notice);
  const service = first(sp.service) || undefined;
  const rawStatus = first(sp.status);
  const status: Status = (STATUSES as readonly string[]).includes(rawStatus ?? "") ? (rawStatus as Status) : "any";
  if (rawStatus !== undefined && rawStatus !== status) notices.push(`Unknown status "${rawStatus}". Using any.`);
  const rawMin = first(sp.min_duration);
  const minDuration = parseMinDuration(rawMin) !== undefined ? rawMin : undefined;
  if (rawMin && minDuration === undefined) notices.push(`Minimum duration "${rawMin}" is invalid (use e.g. 250ms, 2s, 500us). Ignored.`);
  return { window, service, status, minDuration, notices };
}

/** Build a query string, dropping undefined/empty values and defaults. */
export function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
}

const TRACE_ID = /^[0-9a-f]{32}$/;
const SPAN_ID = /^[0-9a-f]{16}$/;
export const isTraceId = (v: string) => TRACE_ID.test(v);
export const isSpanId = (v: string) => SPAN_ID.test(v);

/** Route params may arrive percent-encoded; decode once, falling back to the raw value if malformed. */
export function decodeParam(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
}
