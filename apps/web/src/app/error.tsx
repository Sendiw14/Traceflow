"use client";

import { useEffect, useRef } from "react";

export default function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-16" data-testid="system.500">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">Something broke on our side</h1>
      <p className="mt-2 text-ink-2">The page could not be rendered.{error.digest ? ` Reference: ${error.digest}.` : ""}</p>
      <button type="button" onClick={reset} className="mt-6 rounded-md border border-control bg-paper px-4 py-2">
        Try again
      </button>
    </main>
  );
}
