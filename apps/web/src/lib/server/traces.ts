import "server-only";
import { parseMinDuration, STATUSES } from "@/lib/query/params";
import { listTraces, type Schemas } from "./data";

const isNs = (v: unknown): v is string => typeof v === "string" && /^[0-9]{1,19}$/.test(v);

/** Validates untrusted Server Action input before it reaches trace-api. */
export async function getTraceCursorPage(q: { from: string; to: string; service?: string; status: string; minDuration?: string }, cursor: string):
  Promise<{ ok: true; items: Schemas["TraceSummary"][]; next: string | null } | { ok: false; message: string }> {
  if (!isNs(q?.from) || !isNs(q.to) || typeof cursor !== "string" || cursor.length > 2048 || !(STATUSES as readonly string[]).includes(q.status)) {
    return { ok: false, message: "Invalid paging request. Reload the page." };
  }
  const min = q.minDuration ? parseMinDuration(q.minDuration) : undefined;
  const r = await listTraces({
    from: BigInt(q.from), to: BigInt(q.to), service: q.service || undefined, status: q.status as "any" | "error" | "ok_or_unset",
    minDurationNano: min, cursor, limit: 50,
  });
  if (!r.ok) return { ok: false, message: r.error.detail ?? r.error.title };
  return { ok: true, items: r.data.items, next: r.data.next_cursor };
}
