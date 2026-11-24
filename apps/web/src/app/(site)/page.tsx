import Link from "next/link";

// Placeholder only. The editorial home page (page-matrix `/`) is built at M5; nothing here is a product claim.
export default function Home() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Under construction</p>
      <h1 className="mt-2 text-3xl font-semibold">TRACEFLOW</h1>
      <p className="mt-4 text-ink-2">
        Open-source distributed tracing and diagnostics. This site is in early development; the public pages are not built yet.
      </p>
      <p className="mt-6">
        <Link href="/app">Open the application shell</Link>
      </p>
    </main>
  );
}
