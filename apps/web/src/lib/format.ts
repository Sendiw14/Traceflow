// Display formatting. API counts are JSON integers; ns values are decimal strings (ADR-0004).
import { formatDuration, parseNanos } from "@/lib/time/nanos";

export const DASH = "—";

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** error_fraction (0..1 | null) → "2.4 %" ; null → "—" (never 0). */
export function formatFraction(f: number | null): string {
  if (f === null) return DASH;
  const pct = f * 100;
  return `${pct >= 10 || pct === 0 ? pct.toFixed(pct === 0 ? 0 : 1) : pct.toFixed(2)} %`;
}

/** Percentile value or null → text. null means "insufficient samples", not zero. */
export function formatPercentile(v: string | null): string {
  return v === null ? DASH : formatDuration(v);
}

const FLOORS = { p50: 1, p95: 20, p99: 100 } as const;
export function insufficientReason(key: keyof typeof FLOORS, sampleCount: number): string {
  return `${key} needs ${FLOORS[key]} samples; this window has ${sampleCount}`;
}

/** Unix ns → `HH:mm:ss` UTC. */
export function formatClock(ns: string | bigint): string {
  const v = typeof ns === "bigint" ? ns : parseNanos(ns);
  const d = new Date(Number(v / 1_000_000n));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** Unix ns → `YYYY-MM-DD HH:mm:ss UTC` (seconds precision, for lists). */
export function formatDateTime(ns: string | bigint): string {
  const v = typeof ns === "bigint" ? ns : parseNanos(ns);
  const d = new Date(Number(v / 1_000_000n));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

export function shortId(id: string, n = 8): string {
  return id.slice(0, n);
}

/** Nanosecond string/bigint → number for chart scales only (display; precision beyond 2^53 irrelevant). */
export function nanosToNumber(ns: string | bigint | null): number | null {
  if (ns === null) return null;
  return Number(typeof ns === "bigint" ? ns : parseNanos(ns, { signed: true }));
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${+(n / (1024 * 1024)).toFixed(1)} MiB`;
  if (n >= 1024) return `${+(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}
