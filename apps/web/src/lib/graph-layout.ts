// Deterministic layered left→right layout (no physics, settles instantly). Pure and tested.
export const NODE_W = 170;
export const NODE_H = 56;
const GAP_X = 90;
const GAP_Y = 28;

export interface LNode { id: string; layer: number; index: number; x: number; y: number }
export interface Layout { nodes: LNode[]; byId: Map<string, LNode>; width: number; height: number }

export function layoutGraph(names: string[], edges: { source: string; target: string }[]): Layout {
  const ids = [...new Set(names)].sort();
  const layer = new Map(ids.map((n) => [n, 0]));
  // Longest-path layering; iteration cap keeps cyclic graphs terminating (back edges simply point left).
  for (let i = 0; i < ids.length; i++) {
    let changed = false;
    for (const e of edges) {
      if (e.source === e.target || !layer.has(e.source) || !layer.has(e.target)) continue;
      const want = Math.min(ids.length - 1, layer.get(e.source)! + 1);
      if (layer.get(e.target)! < want) { layer.set(e.target, want); changed = true; }
    }
    if (!changed) break;
  }
  const columns = new Map<number, string[]>();
  for (const n of ids) {
    const l = layer.get(n)!;
    columns.set(l, [...(columns.get(l) ?? []), n]);
  }
  const maxRows = Math.max(1, ...[...columns.values()].map((c) => c.length));
  const height = maxRows * (NODE_H + GAP_Y) - GAP_Y;
  const nodes: LNode[] = [];
  for (const [l, col] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    const colHeight = col.length * (NODE_H + GAP_Y) - GAP_Y;
    const offset = (height - colHeight) / 2;
    col.forEach((id, index) => nodes.push({ id, layer: l, index, x: l * (NODE_W + GAP_X), y: offset + index * (NODE_H + GAP_Y) }));
  }
  const layers = columns.size ? Math.max(...columns.keys()) + 1 : 1;
  return { nodes, byId: new Map(nodes.map((n) => [n.id, n])), width: layers * (NODE_W + GAP_X) - GAP_X, height: Math.max(height, NODE_H) };
}

export type Dir = "left" | "right" | "up" | "down";

/** Nearest node in a direction (keyboard navigation); null when none lies that way. */
export function nearest(nodes: LNode[], from: LNode, dir: Dir): LNode | null {
  let best: LNode | null = null;
  let bestScore = Infinity;
  for (const n of nodes) {
    if (n.id === from.id) continue;
    const dx = n.x - from.x, dy = n.y - from.y;
    const ok = dir === "right" ? dx > 0 : dir === "left" ? dx < 0 : dir === "down" ? dy > 0 : dy < 0;
    if (!ok) continue;
    const along = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy);
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 2;
    if (score < bestScore || (score === bestScore && best && n.id < best.id)) { best = n; bestScore = score; }
  }
  return best;
}

/** Edge stroke width from trace_count on a log scale (legend states the mapping). */
export function edgeWidth(traceCount: number): number {
  return Math.min(8, 1.5 + Math.log2(Math.max(1, traceCount)) * 0.7);
}

/** Request-volume bucket → node border thickness (never colour alone). */
export function volumeBucket(requestCount: number): 1 | 2 | 3 | 4 {
  return requestCount < 10 ? 1 : requestCount < 100 ? 2 : requestCount < 1000 ? 3 : 4;
}
