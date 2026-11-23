"use server";

import { updateSettings, type Schemas } from "@/lib/server/data";

export type UpdateResult =
  | { ok: true; settings: Schemas["Settings"] }
  | { ok: false; code: string; message: string; fieldError?: string };

/** Server Action: validates the (untrusted) value, then asks trace-api. Retention is 1–90 whole days. */
export async function updateRetention(days: unknown): Promise<UpdateResult> {
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 90) {
    return { ok: false, code: "invalid_parameter", message: "Retention must be a whole number of days from 1 to 90.", fieldError: "Enter a whole number from 1 to 90." };
  }
  const r = await updateSettings({ retention_days: days });
  if (r.ok) return { ok: true, settings: r.data };
  if (r.error.code === "forbidden") return { ok: false, code: r.error.code, message: "Not available in this deployment." };
  const field = r.error.errors?.find((e) => e.field === "/retention_days");
  return { ok: false, code: r.error.code, message: r.error.detail ?? r.error.title, fieldError: field?.message };
}
