import "server-only";
import { cache } from "react";
import { currentAuthMode, getOperator, type Operator } from "@/lib/auth/server";
import { actionAllowed, type Area } from "@/lib/profile";

export type Denied = { ok: false; code: "forbidden" | "unauthorized" };

/** Identity lookup that fails closed: an unreachable auth database or any auth error means "not signed in". */
export const safeOperator = cache(async (): Promise<Operator | null> => {
  try {
    return await getOperator();
  } catch {
    return null;
  }
});

/**
 * Gate for Server Actions and server-side data access.
 * - profile must serve the area (`null` = either /app or /demo: shared read actions);
 * - public-demo (auth mode `none`): shared synthetic reads stay unauthenticated;
 * - otherwise (operator-prod, local-dev bootstrap): a signed-in operator is required.
 */
export async function requireAccess(area: Area | null): Promise<{ ok: true; operator: Operator | null } | Denied> {
  if (!actionAllowed(area)) return { ok: false, code: "forbidden" };
  if (currentAuthMode().kind === "none") return { ok: true, operator: null };
  const operator = await safeOperator();
  return operator ? { ok: true, operator } : { ok: false, code: "unauthorized" };
}
