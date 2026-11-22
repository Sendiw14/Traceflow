import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-16" data-testid="system.404">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink-2">This address does not match any page.</p>
      <p className="mt-6"><Link href="/">Go to the home page</Link></p>
    </main>
  );
}
