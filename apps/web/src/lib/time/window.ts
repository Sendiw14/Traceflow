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

export const BUCKETS = [60, 300, 900, 3600] as const;
const MAX_POINTS = 2000; // API cap (window_too_large)

/** Requested bucket if valid and within the 2 000-point cap, else the window default (or the smallest bucket that fits). */
export function chooseBucket(w: Window, requested: string | undefined): number {
  const seconds = Number((w.to - w.from) / 1_000_000_000n);
  const fits = (b: number) => seconds / b <= MAX_POINTS;
  const asked = requested === undefined ? NaN : Number(requested);
  if ((BUCKETS as readonly number[]).includes(asked) && fits(asked)) return asked;
  return fits(w.bucketSeconds) ? w.bucketSeconds : (BUCKETS.find(fits) ?? 3600);
}
