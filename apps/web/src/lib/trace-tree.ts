// Trace span tree, flattening and time axis (pure, tested). Derived only from API fields (page-matrix: no inferred parents).
import type { Schemas } from "@/lib/server/data";

export type SpanT = Schemas["Span"];

export interface Node {
  id: string; // span id, or ORPHAN_GROUP
  span: SpanT | null; // null for the synthetic "Parent span not received" group
  children: Node[];
}
export const ORPHAN_GROUP = "__orphans__";

export interface Row { node: Node; depth: number; hasChildren: boolean; expanded: boolean; parentId: string | null }

const big = (v: string) => BigInt(v);

/**
 * Roots (parent_span_id null) stay at root level. Spans whose parent is declared but not received
 * (`parent_present=false`) go under one synthetic group. Cycles (corrupt data) fall back to root level.
 */
export function buildTree(spans: SpanT[]): Node[] {
  const byId = new Map<string, Node>();
  for (const s of spans) byId.set(s.span_id, { id: s.span_id, span: s, children: [] });
  const roots: Node[] = [];
  const orphans: Node[] = [];
  for (const s of spans) {
    const node = byId.get(s.span_id)!;
    if (s.parent_span_id === null) roots.push(node);
    else if (!s.parent_present) orphans.push(node);
    else {
      const parent = byId.get(s.parent_span_id);
      if (parent && !isAncestor(byId, s.span_id, s.parent_span_id)) parent.children.push(node);
      else roots.push(node); // parent_present but not in the returned (truncated) subset, or cyclic
    }
  }
  const order = (a: Node, b: Node) => {
    const x = big(a.span!.start_unix_nano), y = big(b.span!.start_unix_nano);
    return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
  for (const n of byId.values()) n.children.sort(order);
  roots.sort(order);
  if (orphans.length) {
    orphans.sort(order);
    roots.push({ id: ORPHAN_GROUP, span: null, children: orphans });
  }
  return roots;
}

function isAncestor(byId: Map<string, Node>, candidate: string, of: string): boolean {
  // true if `candidate` appears on the parent chain starting at `of` (would create a cycle)
  let cur: string | null = of;
  for (let i = 0; cur && i < 100_000; i++) {
    if (cur === candidate) return true;
    cur = byId.get(cur)?.span?.parent_span_id ?? null;
  }
  return false;
}

export function flatten(roots: Node[], expanded: ReadonlySet<string>): Row[] {
  const out: Row[] = [];
  const walk = (n: Node, depth: number, parentId: string | null) => {
    const isOpen = expanded.has(n.id);
    out.push({ node: n, depth, hasChildren: n.children.length > 0, expanded: isOpen, parentId });
    if (isOpen) for (const c of n.children) walk(c, depth + 1, n.id);
  };
  for (const r of roots) walk(r, 1, null);
  return out;
}

/** Ids of all nodes that have children (for "expand all"). */
export function parentIds(roots: Node[]): Set<string> {
  const s = new Set<string>();
  const walk = (n: Node) => { if (n.children.length) { s.add(n.id); n.children.forEach(walk); } };
  roots.forEach(walk);
  return s;
}

export interface Axis { start: bigint; end: bigint }

/** [min start, max end] over non-negative-duration spans; negative durations never scale the axis. */
export function computeAxis(spans: SpanT[]): Axis {
  let start: bigint | null = null, end: bigint | null = null;
  for (const s of spans) {
    if (big(s.duration_nano) < 0n) continue;
    const a = big(s.start_unix_nano), b = big(s.end_unix_nano);
    if (start === null || a < start) start = a;
    if (end === null || b > end) end = b;
  }
  if (start === null || end === null) {
    const first = spans[0] ? big(spans[0].start_unix_nano) : 0n;
    return { start: first, end: first + 1n };
  }
  return { start, end: end > start ? end : start + 1n };
}

export interface Bar { leftPct: number; widthPct: number; skew: boolean }

/** Percent geometry within the axis. Zero/short durations get a minimum width; skewed spans a fixed marker. */
export function barGeometry(s: SpanT, axis: Axis, minPct = 0.3): Bar {
  const range = Number(axis.end - axis.start);
  const clamp = (x: number) => Math.min(100, Math.max(0, x));
  const left = clamp((Number(big(s.start_unix_nano) - axis.start) / range) * 100);
  const skew = big(s.duration_nano) < 0n;
  const w = skew ? minPct : (Number(big(s.duration_nano)) / range) * 100;
  const width = Math.max(minPct, Math.min(w, 100 - left));
  return { leftPct: left, widthPct: Math.max(width, minPct), skew };
}

/** Ordered span ids with an error status (for "next error span"). */
export function errorSpanIds(spans: SpanT[]): string[] {
  return spans.filter((s) => s.status.code === "error").map((s) => s.span_id);
}
