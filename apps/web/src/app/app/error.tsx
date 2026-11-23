"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-error bg-[var(--tf-error-tint)] p-6" data-testid="system.500">
      <h1 className="text-xl font-semibold">Something broke on our side</h1>
      <p className="mt-1 text-sm text-ink-2">This page could not be rendered.{error.digest ? ` Reference: ${error.digest}.` : ""}</p>
      <button type="button" className="btn mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
