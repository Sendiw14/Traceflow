// URL-driven time window (page-matrix §0). Relative ranges resolve to absolute from/to once per request.
export const RANGES = ["15m", "1h", "6h", "24h", "7d"] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = "1h";

const SECONDS: Record<Range, number> = { "15m": 900, "1h": 3600, "6h": 21600, "24h": 86400, "7d": 604800 };
/** bucket_seconds is an enum in the API; these are the only values the UI uses (page-matrix /app "Bucket rule"). */
const BUCKET: Record<Range, number> = { "15m": 60, "1h": 60, "6h": 300, "24h": 300, "7d": 3600 };

export interface Window {
  range: Range;
  from: bigint;
  to: bigint;
  bucketSeconds: number;
  /** Set when the URL value was invalid and the default was used. */
  notice?: string;
}

export function isRange(v: unknown): v is Range {
  return typeof v === "string" && (RANGES as readonly string[]).includes(v);
}

export function resolveWindow(raw: string | undefined, nowMs: number = Date.now()): Window {
  const valid = raw === undefined || isRange(raw);
  const range = isRange(raw) ? raw : DEFAULT_RANGE;
  const to = BigInt(nowMs) * 1_000_000n;
  const from = to - BigInt(SECONDS[range]) * 1_000_000_000n;
  return { range, from, to, bucketSeconds: BUCKET[range], ...(valid ? {} : { notice: `Unknown time range "${raw}". Using ${DEFAULT_RANGE}.` }) };
}

/** Same window shifted back by its own length (analytics compare). */
export function previousWindow(w: Window): Window {
  const len = w.to - w.from;
  return { ...w, from: w.from - len, to: w.from };
}
