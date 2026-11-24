"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_PAGES } from "./docs-pages";

function Links({ path }: { path: string }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {DOCS_PAGES.map((p) => (
        <li key={p.href}>
          <Link href={p.href} aria-current={path === p.href ? "page" : undefined}
            className={`block rounded-md px-3 py-2 no-underline ${path === p.href ? "bg-signal-tint font-semibold text-signal-strong" : "text-ink-2 hover:bg-sunken"}`}>
            {p.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Sidebar from 768 px, "Docs menu" disclosure below. Both variants are server-rendered and switched by CSS only
 * (the hidden one is display:none, so it is not in the accessibility tree): no hydration-time state flip, so no layout shift.
 */
export function DocsNav() {
  const path = usePathname();
  return (
    <>
      <nav aria-label="Documentation" data-testid="docs.nav" className="hidden md:block"><Links path={path} /></nav>
      <details className="rounded-lg border border-line bg-paper p-3 md:hidden" data-testid="docs.nav-details">
        <summary className="cursor-pointer font-medium">Docs menu</summary>
        <nav aria-label="Documentation" data-testid="docs.nav-mobile" className="mt-2"><Links path={path} /></nav>
      </details>
    </>
  );
}
