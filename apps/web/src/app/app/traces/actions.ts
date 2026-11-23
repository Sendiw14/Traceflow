"use server";

import { getTraceCursorPage } from "@/lib/server/traces";
import type { Schemas } from "@/lib/server/data";

export interface TraceQuery {
  from: string;
  to: string;
  service?: string;
  status: "any" | "error" | "ok_or_unset";
  minDuration?: string;
}
export type MoreResult = { ok: true; items: Schemas["TraceSummary"][]; next: string | null } | { ok: false; message: string };

/** Server Action: the browser asks the BFF for the next page; trace-api stays server-side. */
export async function loadMoreTraces(q: TraceQuery, cursor: string): Promise<MoreResult> {
  return getTraceCursorPage(q, cursor);
}
