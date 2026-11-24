import { NextResponse, type NextRequest } from "next/server";
import { allows, areaOf, parseProfile } from "@/lib/profile";

/**
 * Server-side profile gate (authz-matrix.md): public-demo has no /app, operator-prod has no /demo,
 * and a missing/unknown TRACEFLOW_PROFILE gates both. Runs for every request incl. Server Action POSTs.
 */
export function proxy(req: NextRequest) {
  const area = areaOf(req.nextUrl.pathname);
  if (area && !allows(parseProfile(process.env.TRACEFLOW_PROFILE), area)) {
    return NextResponse.rewrite(new URL("/__gated_not_found", req.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app", "/app/:path*", "/demo", "/demo/:path*"] };
