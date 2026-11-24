"use client";

import { useState } from "react";
import { isGithubAuthorizeUrl } from "@/lib/login";

/** Starts GitHub OAuth through the BFF endpoint and navigates to the returned authorize URL. */
export function SignInButton({ next }: { next: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const go = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "github", callbackURL: next }),
      });
      const body = (await res.json().catch(() => null)) as { url?: unknown } | null;
      if (!res.ok || !isGithubAuthorizeUrl(body?.url)) throw new Error("bad response");
      window.location.assign(body!.url as string);
    } catch {
      setState("error");
    }
  };
  return (
    <div>
      <button type="button" className="btn btn-primary w-full py-3 text-base" onClick={go} disabled={state === "busy"} aria-busy={state === "busy"} data-testid="login.github-button">
        {state === "busy" ? "Redirecting to GitHub…" : "Sign in with GitHub"}
      </button>
      <p role="alert" className="mt-2 text-sm text-error" data-testid="login.send-error">{state === "error" ? "Could not start sign-in. Check your connection and try again." : ""}</p>
    </div>
  );
}
