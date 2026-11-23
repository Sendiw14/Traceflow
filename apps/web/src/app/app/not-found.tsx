import Link from "next/link";

export default function AppNotFound() {
  return (
    <div role="status" data-testid="system.404" className="rounded-md border border-dashed border-control bg-paper p-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink-2">This address does not match any page or the ID has an invalid format.</p>
      <p className="mt-4 flex gap-4"><Link href="/app">Go to the overview</Link><Link href="/">Home</Link></p>
    </div>
  );
}
