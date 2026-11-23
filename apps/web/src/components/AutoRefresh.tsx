"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** Refreshes server data on an interval while the tab is visible; never overlaps refreshes. */
export function AutoRefresh({ seconds, active }: { seconds: number; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  useEffect(() => {
    if (!active || hidden || pending) return;
    const id = setTimeout(() => start(() => router.refresh()), seconds * 1000);
    return () => clearTimeout(id);
  }, [active, hidden, pending, seconds, router]);
  return active ? <p className="m-0 text-xs text-ink-3">{hidden ? "Paused (tab hidden)." : `Checking every ${seconds} s.`}</p> : null;
}
