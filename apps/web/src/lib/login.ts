// Pure helpers for the sign-in flow (no server imports; safe in client components).

/**
 * Return path after sign-in: only same-origin `/app` paths. Anything else (other origins, protocol-relative,
 * backslashes, control characters, `/application`, over-long values) falls back to `/app`.
 */
export function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string" || v.length === 0 || v.length > 512) return "/app";
  if (!/^\/app(?:[/?#]|$)/.test(v)) return "/app";
  if (/[\\\u0000-\u001f\u007f\s]/.test(v)) return "/app";
  try {
    const u = new URL(v, "https://placeholder.invalid");
    if (u.origin !== "https://placeholder.invalid") return "/app";
    if (u.pathname !== "/app" && !u.pathname.startsWith("/app/")) return "/app";
  } catch {
    return "/app";
  }
  return v;
}

export function loginUrl(next: string, reason?: "expired"): string {
  const q = new URLSearchParams({ next: safeNext(next) });
  if (reason) q.set("reason", reason);
  return `/login?${q.toString()}`;
}

/** Only follow the provider URL if it is an https GitHub URL (the endpoint response is untrusted input to the browser). */
export function isGithubAuthorizeUrl(u: unknown): u is string {
  if (typeof u !== "string") return false;
  try {
    const p = new URL(u);
    return p.protocol === "https:" && p.hostname === "github.com";
  } catch {
    return false;
  }
}
