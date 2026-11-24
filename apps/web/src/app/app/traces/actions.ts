"use server";

import { requireAccess } from "@/lib/server/guard";
import { getTraceCursorPage } from "@/lib/server/traces";
import type { Schemas } from "@/lib/server/data";

export interface TraceQuery {
  from: string;
  to: string;
  service?: string;
  status: "any" | "error" | "ok_or_unset";
  minDuration?: string;
}
export type MoreResult = { ok: true; items: Schemas["TraceSummary"][]; next: string | null } | { ok: false; message: string; unauthorized?: boolean };

/** Server Action: the browser asks the BFF for the next page; trace-api stays server-side. */
export async function loadMoreTraces(q: TraceQuery, cursor: string): Promise<MoreResult> {
  const access = await requireAccess(null);
  if (!access.ok) return { ok: false, message: access.code === "unauthorized" ? "Your session expired. Sign in again." : "Not available in this deployment.", unauthorized: access.code === "unauthorized" };
  return getTraceCursorPage(q, cursor);
}
