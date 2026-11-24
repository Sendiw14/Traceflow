"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { DOCS_PAGES } from "./docs-pages";


const query = "(min-width: 768px)";
const subscribe = (cb: () => void) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

/** Sidebar on desktop; collapsed "Docs menu" disclosure below 768 px (page-matrix /docs). */
export function DocsNav() {
  const path = usePathname();
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
  return (
    <details open={wide ? true : undefined} className="rounded-lg border border-line bg-paper p-3 md:border-0 md:bg-transparent md:p-0" data-testid="docs.nav-details">
      <summary className={`cursor-pointer font-medium ${wide ? "hidden" : ""}`}>Docs menu</summary>
      <nav aria-label="Documentation" data-testid="docs.nav" className="mt-2 md:mt-0">
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
      </nav>
    </details>
  );
}
