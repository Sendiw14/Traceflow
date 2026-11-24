import Link from "next/link";
import type { ReactNode } from "react";
import { DOCS_PAGES } from "./docs-pages";

export interface TocItem { id: string; title: string }

/** Article frame: h1, lead, "On this page" (collapsible below 1024 px), prev/next. Section headings are written as <h2 id> by the page. */
export function DocArticle({ path, title, lead, toc, children }: { path: string; title: string; lead: ReactNode; toc: TocItem[]; children: ReactNode }) {
  const i = DOCS_PAGES.findIndex((p) => p.href === path);
  const prev = i > 0 ? DOCS_PAGES[i - 1] : undefined;
  const next = i >= 0 && i < DOCS_PAGES.length - 1 ? DOCS_PAGES[i + 1] : undefined;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_200px]">
      <article className="min-w-0 max-w-3xl" data-testid="docs.article">
        <h1 className="font-serif text-4xl tracking-tight">{title}</h1>
        <p className="mt-3 text-lg text-ink-2">{lead}</p>
        <details className="mt-4 rounded-md border border-line p-3 lg:hidden"><summary className="cursor-pointer text-sm font-medium">On this page</summary>
          <TocList toc={toc} /></details>
        <div className="docs-prose mt-6">{children}</div>
        <nav aria-label="Previous and next" className="mt-12 flex justify-between gap-4 border-t border-line pt-4 text-sm" data-testid="docs.prevnext">
          {prev ? <Link href={prev.href}>← {prev.label}</Link> : <span />}
          {next ? <Link href={next.href}>{next.label} →</Link> : <span />}
        </nav>
      </article>
      <aside className="hidden lg:block">
        <nav aria-label="On this page" data-testid="docs.toc" className="sticky top-6 text-sm">
          <p className="mb-2 font-medium">On this page</p>
          <TocList toc={toc} />
        </nav>
      </aside>
    </div>
  );
}

function TocList({ toc }: { toc: TocItem[] }) {
  return <ul className="m-0 mt-2 list-none space-y-1 p-0 text-sm">{toc.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.title}</a></li>)}</ul>;
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mt-10 scroll-mt-6 text-2xl font-semibold">{children}</h2>;
}
export function Callout({ kind = "info", title, children }: { kind?: "info" | "warn"; title: string; children: ReactNode }) {
  const style = kind === "warn" ? "border-[var(--tf-warning-fill)] bg-[var(--tf-warning-tint)]" : "border-line bg-sunken";
  return (
    <div role="note" className={`my-4 rounded-md border px-4 py-3 text-sm ${style}`}>
      <p className="m-0 font-semibold"><span aria-hidden="true">{kind === "warn" ? "⚠ " : "ℹ "}</span>{title}</p>
      <div className="mt-1 text-ink-2">{children}</div>
    </div>
  );
}
