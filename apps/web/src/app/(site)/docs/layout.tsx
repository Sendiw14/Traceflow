import { DocsNav } from "@/components/site/DocsNav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p role="note" className="mb-6 rounded-md border border-line bg-sunken px-3 py-2 text-sm text-ink-2" data-testid="docs.version-banner">
        <strong>V1, in development.</strong> These docs describe what exists in the repository today. Anything not built is marked as such.
      </p>
      <div className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
        <aside><DocsNav /></aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
