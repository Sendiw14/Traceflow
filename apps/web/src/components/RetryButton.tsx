"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RetryButton({ label = "Retry" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending} onClick={() => start(() => router.refresh())} data-testid="state.retry">
      {pending ? "Retrying…" : label}
    </button>
  );
}
