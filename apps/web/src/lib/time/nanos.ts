// API timestamps/durations are decimal-string nanoseconds (ADR-0004). Never convert timestamps via Number.
const UNSIGNED = /^[0-9]{1,19}$/;
const SIGNED = /^-?[0-9]{1,19}$/;

export function parseNanos(value: string, { signed = false }: { signed?: boolean } = {}): bigint {
  if (!(signed ? SIGNED : UNSIGNED).test(value)) throw new RangeError(`invalid nanosecond value: ${value}`);
  return BigInt(value);
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Unix ns → `YYYY-MM-DD HH:mm:ss.SSS UTC` (millisecond precision, truncated, never rounded up). */
export function formatTimestampUTC(ns: string | bigint): string {
  const v = typeof ns === "bigint" ? ns : parseNanos(ns);
  const d = new Date(Number(v / 1_000_000n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)} ` +
    `${pad(d.getUTCHours(), 2)}:${pad(d.getUTCMinutes(), 2)}:${pad(d.getUTCSeconds(), 2)}.${pad(d.getUTCMilliseconds(), 3)} UTC`;
}

/** Duration ns → `412 µs` / `18.4 ms` / `2.31 s` (3 significant digits, unit always present). Negative = clock skew. */
export function formatDuration(ns: string | bigint): string {
  const v = typeof ns === "bigint" ? ns : parseNanos(ns, { signed: true });
  if (v < 0n) return `−${formatDuration(-v)}`;
  if (v < 1_000n) return `${v} ns`;
  const [div, unit] = v < 1_000_000n ? [1_000n, "µs"] : v < 1_000_000_000n ? [1_000_000n, "ms"] : [1_000_000_000n, "s"];
  const whole = v / div;
  const digits = whole >= 100n ? 0 : whole >= 10n ? 1 : 2;
  const scaled = (v * 10n ** BigInt(digits)) / div; // truncate
  const text = digits === 0 ? scaled.toString() : `${scaled / 10n ** BigInt(digits)}.${(scaled % 10n ** BigInt(digits)).toString().padStart(digits, "0")}`;
  return `${text} ${unit}`;
}
