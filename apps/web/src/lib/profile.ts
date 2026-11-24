// Deployment profile gating (authz-matrix.md). Enforced server-side per request; links are never the control.
export const PROFILES = ["local-dev", "operator-prod", "public-demo"] as const;
export type Profile = (typeof PROFILES)[number];
export type Area = "app" | "demo";

/** Unknown or missing profile → null, which allows nothing gated (fail closed). */
export function parseProfile(v: string | undefined): Profile | null {
  return (PROFILES as readonly string[]).includes(v ?? "") ? (v as Profile) : null;
}

const ALLOWED: Record<Profile, readonly Area[]> = {
  "local-dev": ["app", "demo"],
  "operator-prod": ["app"],
  "public-demo": ["demo"],
};

export function allows(profile: Profile | null, area: Area): boolean {
  return profile !== null && ALLOWED[profile].includes(area);
}

/** Which gated area a pathname belongs to, if any. `/app` and `/app/...` but not `/application`. */
export function areaOf(pathname: string): Area | null {
  if (pathname === "/app" || pathname.startsWith("/app/")) return "app";
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return "demo";
  return null;
}

export function currentProfile(): Profile | null {
  return parseProfile(process.env.TRACEFLOW_PROFILE);
}
