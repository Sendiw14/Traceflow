import Link from "next/link";
import { GITHUB, Wordmark } from "@/components/site/SiteChrome";
import { assertArea } from "@/lib/profile";

// Public demo: dynamic (profile-gated), read-only, synthetic data only. No `private` cache header required.
export const dynamic = "force-dynamic";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  assertArea("demo"); // independent of proxy.ts
  return (
    <>
      <div role="note" data-testid="demo.banner" className="border-b border-[var(--tf-violet)] bg-[var(--tf-violet-tint)] px-4 py-2 text-center text-sm font-medium text-[var(--tf-violet-strong)]">
        Synthetic data — read-only demo. No real traffic.
      </div>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Wordmark />
          <nav aria-label="Demo">
            <ul className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-sm">
              <li><Link href="/demo#overview" className="rounded-md px-3 py-2 text-ink-2 no-underline hover:bg-sunken">Overview</Link></li>
              <li><Link href="/demo#services" className="rounded-md px-3 py-2 text-ink-2 no-underline hover:bg-sunken">Services</Link></li>
              <li><Link href="/demo#traces" className="rounded-md px-3 py-2 text-ink-2 no-underline hover:bg-sunken">Traces</Link></li>
              <li><Link href="/docs" className="rounded-md px-3 py-2 text-ink-2 no-underline hover:bg-sunken">Docs</Link></li>
              <li><a href={GITHUB} className="rounded-md px-3 py-2 text-ink-2 no-underline hover:bg-sunken">GitHub</a></li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 md:py-8">{children}</main>
    </>
  );
}
