import Link from "next/link";

export const GITHUB = "https://github.com/Sendiw14/Traceflow";
export const LICENSE_URL = `${GITHUB}/blob/main/LICENSE`;

/** Signal-path mark (identity.md §4): one path entering from the left, forking into two branches, one ending in a junction dot. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12H8M8 12L14 6H20M8 12L14 18H20" stroke="var(--tf-ink)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="6" r="2" fill="var(--tf-signal)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 text-ink no-underline" aria-label="traceflow, home">
      <Mark />
      <span className="font-serif text-xl tracking-tight">traceflow</span>
    </Link>
  );
}

export function SiteHeader({ demo }: { demo: boolean }) {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Wordmark />
        <nav aria-label="Main">
          <ul className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-sm">
            <li><Link href="/docs" className="rounded-md px-3 py-2 text-ink-2 no-underline hover:bg-sunken">Docs</Link></li>
            {demo && <li><Link href="/demo" className="rounded-md px-3 py-2 text-ink-2 no-underline hover:bg-sunken">Demo</Link></li>}
            <li><a href={GITHUB} className="rounded-md px-3 py-2 text-ink-2 no-underline hover:bg-sunken">GitHub</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ demo }: { demo: boolean }) {
  return (
    <footer className="mt-16 border-t border-line bg-paper" data-testid="footer">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-4 py-8 text-sm text-ink-2">
        <div>
          <Wordmark />
          <p className="mt-2 max-w-sm text-ink-3">Self-hostable, open-source distributed tracing. V1, in development.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
            <li><Link href="/docs">Docs</Link></li>
            {demo && <li><Link href="/demo">Live demo</Link></li>}
            <li><a href={GITHUB}>GitHub</a></li>
            <li><a href={LICENSE_URL}>Apache-2.0 licence</a></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
