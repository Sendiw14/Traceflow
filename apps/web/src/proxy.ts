import { NextResponse, type NextRequest } from "next/server";
import { allows, areaOf, parseProfile } from "@/lib/profile";

/**
 * Server-side profile gate (authz-matrix.md): public-demo has no /app or /login, operator-prod has no /demo,
 * local-dev has no /login, and a missing/unknown TRACEFLOW_PROFILE gates everything. Runs for every request incl.
 * Server Action POSTs. Layouts and actions re-check independently (ADR-0005). It also forwards the requested path
 * so the /app layout can build `/login?next=`; the layout falls back to `/app` if this header is absent.
 */
export function proxy(req: NextRequest) {
  const area = areaOf(req.nextUrl.pathname);
  if (area && !allows(parseProfile(process.env.TRACEFLOW_PROFILE), area)) {
    return NextResponse.rewrite(new URL("/__gated_not_found", req.url), { status: 404 });
  }
  const headers = new Headers(req.headers);
  headers.set("x-tf-path", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/app", "/app/:path*", "/demo", "/demo/:path*", "/login", "/login/:path*"] };
