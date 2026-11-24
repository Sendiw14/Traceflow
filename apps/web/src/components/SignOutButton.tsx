"use client";

import { useState } from "react";

/** POST /api/auth/sign-out (same origin), then show the signed-out confirmation. The server sends Clear-Site-Data and no-store. */
export function SignOutButton() {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const out = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error(String(res.status));
      // Full document load on purpose: drops the client router cache so Back cannot show private pages.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login?signedout=1";
    } catch {
      setState("error");
    }
  };
  return (
    <div>
      <button type="button" className="btn w-full" onClick={out} disabled={state === "busy"} data-testid="shell.sign-out">
        {state === "busy" ? "Signing out…" : "Sign out"}
      </button>
      <p role="alert" className="mt-1 text-xs text-error">{state === "error" ? "Sign-out failed. Try again." : ""}</p>
    </div>
  );
}
