import Link from "next/link";
import type { ReactNode } from "react";
import type { ApiProblem } from "@/lib/server/data";
import { problemCopy } from "@/lib/problem-copy";
import { RetryButton } from "./RetryButton";

export function PageHeader({ title, children, testId }: { title: string; children?: ReactNode; testId?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4" data-testid={testId}>
      <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export function Panel({ title, id, children, className = "", testId }: { title?: string; id?: string; children: ReactNode; className?: string; testId?: string }) {
  const hid = id ? `${id}-h` : undefined;
  return (
    <section aria-labelledby={hid} className={`rounded-lg border border-line bg-paper p-4 ${className}`} data-testid={testId}>
      {title && <h2 id={hid} className="mb-3 text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

type NoticeKind = "info" | "warn" | "error";
const NOTICE_STYLE: Record<NoticeKind, string> = {
  info: "border-line bg-sunken text-ink-2",
  warn: "border-[var(--tf-warning-fill)] bg-[var(--tf-warning-tint)] text-[var(--tf-warning-text)]",
  error: "border-error bg-[var(--tf-error-tint)] text-error",
};
const ICON: Record<NoticeKind, string> = { info: "ℹ", warn: "⚠", error: "✕" };

/** Partial-state notice: icon + text, never colour alone. */
export function Notice({ kind = "info", children, testId }: { kind?: NoticeKind; children: ReactNode; testId?: string }) {
  return (
    <p role="status" className={`my-2 rounded-md border px-3 py-2 text-sm ${NOTICE_STYLE[kind]}`} data-testid={testId} data-state="partial">
      <span aria-hidden="true" className="mr-2">{ICON[kind]}</span>
      {children}
    </p>
  );
}

export function EmptyState({ state, title, children }: { state: "empty-nodata" | "empty-nomatch" | "empty-window"; title: string; children?: ReactNode }) {
  return (
    <div role="status" className="rounded-md border border-dashed border-control bg-paper p-6 text-center" data-state={state} data-testid={`state.${state}`}>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function ProblemState({ problem, resetHref, compact }: { problem: ApiProblem; resetHref?: string; compact?: boolean }) {
  const copy = problemCopy(problem.code);
  return (
    <div role="alert" className={`rounded-md border border-error bg-[var(--tf-error-tint)] ${compact ? "p-3" : "p-6"}`} data-state="error" data-testid="state.error" data-code={problem.code}>
      <p className="font-semibold text-error"><span aria-hidden="true">✕ </span>{copy.heading}</p>
      <p className="mt-1 text-sm text-ink-2">{copy.body}</p>
      {problem.detail && <p className="mt-1 text-sm text-ink-2">{problem.detail}</p>}
      {problem.errors?.map((e) => (
        <p key={`${e.field}-${e.code}`} className="mt-1 text-sm text-ink-2">{e.field}: {e.message}</p>
      ))}
      {problem.retryAfter ? <p className="mt-1 text-sm text-ink-2">Retry after {problem.retryAfter} s.</p> : null}
      <div className="mt-3 flex gap-3">
        {copy.kind === "link" && resetHref ? <Link href={resetHref} className="btn">Reset view</Link> : <RetryButton />}
      </div>
    </div>
  );
}

export function Badge({ tone, children, testId }: { tone: "ok" | "error" | "warn" | "neutral"; children: ReactNode; testId?: string }) {
  const style = {
    ok: "bg-[var(--tf-success-tint)] text-[var(--tf-success)]",
    error: "bg-[var(--tf-error-tint)] text-error",
    warn: "bg-[var(--tf-warning-tint)] text-[var(--tf-warning-text)]",
    neutral: "bg-sunken text-ink-2",
  }[tone];
  const icon = { ok: "✓", error: "✕", warn: "⚠", neutral: "•" }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium ${style}`} data-testid={testId}>
      <span aria-hidden="true">{icon}</span>{children}
    </span>
  );
}

export function Kpi({ label, value, note, testId, href }: { label: string; value: ReactNode; note?: ReactNode; testId: string; href?: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4" data-testid={testId}>
      <p className="text-sm text-ink-3">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
      {href && <Link href={href} className="mt-1 inline-block text-xs">View example</Link>}
    </div>
  );
}

export function Skeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" data-state="loading" data-testid="state.loading">
      <p role="status" className="sr-only">{label}</p>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => <div key={i} className="h-8 rounded-md bg-sunken" />)}
      </div>
    </div>
  );
}
