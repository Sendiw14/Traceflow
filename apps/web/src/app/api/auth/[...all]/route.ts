// SPDX-License-Identifier: Apache-2.0
// Owner: Opus (ADR-0005). GitHub OAuth endpoints exist only in operator-prod with complete config.
import { handleAuthRequest } from "@/lib/auth/core";
import { authInstance, currentAuthMode } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const mode = currentAuthMode();
  if (mode.kind !== "github") {
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const { auth } = await authInstance(mode.config);
  return handleAuthRequest(auth, mode.config, req);
}

export { handle as GET, handle as POST };
