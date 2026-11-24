import { CopyButton } from "@/components/CopyButton";

/** Static code with a copy button. Scrollable region is keyboard reachable. */
export function CodeBlock({ code, label, lang = "sh", copyId }: { code: string; label: string; lang?: string; copyId?: string }) {
  return (
    <div className="my-4 rounded-lg border border-line bg-paper" data-testid="docs.code">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs text-ink-3">
        <span>{label} <span className="sr-only">({lang})</span></span>
        <CopyButton value={code} label="code" testId={copyId ?? "docs.code.copy"} />
      </div>
      <pre tabIndex={0} aria-label={`${label}`} className="m-0 overflow-x-auto p-3 text-[13px] leading-5"><code className="mono">{code}</code></pre>
    </div>
  );
}
