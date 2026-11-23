"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Only routes that exist (no phantom links).
const NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: "/app", label: "Overview", exact: true },
];

export function AppNav() {
  const path = usePathname();
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0 md:mt-6 md:flex-col">
      {NAV.map((item) => {
        const current = item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link href={item.href} aria-current={current ? "page" : undefined}
              className={`block rounded-md px-3 py-2 no-underline ${current ? "bg-signal-tint font-semibold text-signal-strong" : "text-ink-2 hover:bg-sunken"}`}>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
