import Link from "next/link";

// Private segment: never prerender or share-cache (spec §7, §11).
export const dynamic = "force-dynamic";

// Shell only: no data, no auth (auth lands with ADR-0005 spike). Nav lists routes that exist.
const NAV = [{ href: "/app", label: "Overview" }] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <header className="border-b border-line bg-paper px-4 py-3 md:hidden">
        <Link href="/" className="font-semibold text-ink no-underline">traceflow</Link>
      </header>
      <nav aria-label="Primary" className="border-b border-line bg-paper p-4 md:border-r md:border-b-0">
        <Link href="/" className="hidden font-semibold text-ink no-underline md:block">traceflow</Link>
        <ul className="m-0 flex list-none gap-2 p-0 md:mt-6 md:flex-col">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current="page" className="block rounded-md bg-signal-tint px-3 py-2 text-signal-strong no-underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div id="main" tabIndex={-1} className="p-4 md:p-8">{children}</div>
    </div>
  );
}
