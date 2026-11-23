"use client";

import { useState } from "react";

export function CopyButton({ value, label, testId = "copy" }: { value: string; label: string; testId?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  };
  return (
    <>
      <button type="button" className="btn px-2 py-0.5 text-xs" onClick={copy} data-testid={testId}>
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : `Copy ${label}`}
      </button>
      <span role="status" className="sr-only">{state === "copied" ? `${label} copied` : state === "failed" ? "Copy failed. Select the text manually." : ""}</span>
    </>
  );
}
