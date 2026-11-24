import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { allows, currentProfile } from "@/lib/profile";

// The nav/footer depend on TRACEFLOW_PROFILE (read at request time), so the public site is rendered per request.
export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const demo = allows(currentProfile(), "demo");
  return (
    <>
      <SiteHeader demo={demo} />
      <main id="main" tabIndex={-1}>{children}</main>
      <SiteFooter demo={demo} />
    </>
  );
}
