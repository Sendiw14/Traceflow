import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { assertArea } from "@/lib/profile";

// Private segment: never prerender or share-cache (spec §7, §11).
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  assertArea("app"); // independent of proxy.ts
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <header className="flex items-center justify-between border-b border-line bg-paper px-4 py-3 md:hidden">
        <Link href="/" className="font-semibold text-ink no-underline">traceflow</Link>
      </header>
      <nav aria-label="Primary" className="border-b border-line bg-paper p-4 md:border-r md:border-b-0">
        <Link href="/" className="hidden font-semibold text-ink no-underline md:block">traceflow</Link>
        <AppNav />
      </nav>
      <main id="main" tabIndex={-1} className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}
