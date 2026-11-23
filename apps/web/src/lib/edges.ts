import type { Schemas } from "@/lib/server/data";

type Edge = Schemas["DependencyEdge"];

export function edgeEvidenceText(e: Edge): string {
  return e.evidence.basis === "client_server_parent_child"
    ? `Verified: client span in ${e.source} → server span in ${e.target}`
    : "Observed parent→child across services (no client/server pair)";
}

export const edgeKey = (e: Edge) => `${e.source}\u0000${e.target}`;

/** Edges touching a service, split by direction. */
export function edgesOf(name: string, edges: Edge[]): { upstream: Edge[]; downstream: Edge[] } {
  return { upstream: edges.filter((e) => e.target === name), downstream: edges.filter((e) => e.source === name) };
}
