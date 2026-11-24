// Shape of the five deterministic demo scenarios (examples/demo-system: gateway → orders → inventory).
// Captured from one local run of the real stack on 2026-11-24 via GET /v1/traces/{id}; span IDs are shortened
// and timings are that run's values (rounded to 0.1 ms). Synthetic data only: nothing here is a measurement of anything but the demo.
export type DemoSpan = {
  id: string; parent: string; parentPresent: boolean; name: string;
  kind: "server" | "client" | "internal"; service: "gateway" | "orders" | "inventory";
  startMs: number; durMs: number; status: "unset" | "ok" | "error";
};
export type Scenario = "normal" | "slow" | "error" | "parallel" | "missing-parent";
export const SCENARIOS: Scenario[] = ["normal", "slow", "error", "parallel", "missing-parent"];
export const DEMO_TRACES: Record<Scenario, DemoSpan[]> = {
  "normal": [
    {"id": "e3c4", "parent": "", "parentPresent": true, "name": "GET /checkout", "kind": "server", "service": "gateway", "startMs": 0.0, "durMs": 26.6, "status": "unset"},
    {"id": "ed1f", "parent": "e3c4", "parentPresent": true, "name": "GET", "kind": "client", "service": "gateway", "startMs": 0.3, "durMs": 26.2, "status": "unset"},
    {"id": "e2d3", "parent": "ed1f", "parentPresent": true, "name": "GET /orders", "kind": "server", "service": "orders", "startMs": 1.8, "durMs": 24.2, "status": "unset"},
    {"id": "3ab6", "parent": "e2d3", "parentPresent": true, "name": "GET", "kind": "client", "service": "orders", "startMs": 2.3, "durMs": 23.6, "status": "unset"},
    {"id": "66e8", "parent": "3ab6", "parentPresent": true, "name": "GET /stock", "kind": "server", "service": "inventory", "startMs": 3.7, "durMs": 21.4, "status": "unset"},
    {"id": "9c44", "parent": "66e8", "parentPresent": true, "name": "SELECT stock", "kind": "client", "service": "inventory", "startMs": 3.7, "durMs": 21.2, "status": "unset"},
  ],
  "slow": [
    {"id": "84f6", "parent": "", "parentPresent": true, "name": "GET /checkout", "kind": "server", "service": "gateway", "startMs": 0.0, "durMs": 828.3, "status": "unset"},
    {"id": "dbe6", "parent": "84f6", "parentPresent": true, "name": "GET", "kind": "client", "service": "gateway", "startMs": 0.6, "durMs": 827.6, "status": "unset"},
    {"id": "edf8", "parent": "dbe6", "parentPresent": true, "name": "GET /orders", "kind": "server", "service": "orders", "startMs": 0.9, "durMs": 826.8, "status": "unset"},
    {"id": "02a1", "parent": "edf8", "parentPresent": true, "name": "GET", "kind": "client", "service": "orders", "startMs": 1.0, "durMs": 826.5, "status": "unset"},
    {"id": "7ecd", "parent": "02a1", "parentPresent": true, "name": "GET /stock", "kind": "server", "service": "inventory", "startMs": 1.6, "durMs": 824.9, "status": "unset"},
    {"id": "985d", "parent": "7ecd", "parentPresent": true, "name": "SELECT stock", "kind": "client", "service": "inventory", "startMs": 1.6, "durMs": 824.5, "status": "unset"},
  ],
  "error": [
    {"id": "5c21", "parent": "", "parentPresent": true, "name": "GET /checkout", "kind": "server", "service": "gateway", "startMs": 0.0, "durMs": 24.2, "status": "error"},
    {"id": "8824", "parent": "5c21", "parentPresent": true, "name": "GET", "kind": "client", "service": "gateway", "startMs": 0.1, "durMs": 24.1, "status": "error"},
    {"id": "f884", "parent": "8824", "parentPresent": true, "name": "GET /orders", "kind": "server", "service": "orders", "startMs": 2.2, "durMs": 21.9, "status": "error"},
    {"id": "531d", "parent": "f884", "parentPresent": true, "name": "GET", "kind": "client", "service": "orders", "startMs": 2.5, "durMs": 21.5, "status": "error"},
    {"id": "e084", "parent": "531d", "parentPresent": true, "name": "GET /stock", "kind": "server", "service": "inventory", "startMs": 3.2, "durMs": 20.3, "status": "error"},
    {"id": "f076", "parent": "e084", "parentPresent": true, "name": "SELECT stock", "kind": "client", "service": "inventory", "startMs": 3.2, "durMs": 20.2, "status": "unset"},
  ],
  "parallel": [
    {"id": "6d9a", "parent": "", "parentPresent": true, "name": "GET /checkout", "kind": "server", "service": "gateway", "startMs": 0.0, "durMs": 23.1, "status": "unset"},
    {"id": "f70e", "parent": "6d9a", "parentPresent": true, "name": "GET", "kind": "client", "service": "gateway", "startMs": 0.1, "durMs": 23.0, "status": "unset"},
    {"id": "914c", "parent": "f70e", "parentPresent": true, "name": "GET /orders", "kind": "server", "service": "orders", "startMs": 0.3, "durMs": 22.6, "status": "unset"},
    {"id": "9712", "parent": "914c", "parentPresent": true, "name": "GET", "kind": "client", "service": "orders", "startMs": 0.3, "durMs": 22.3, "status": "unset"},
    {"id": "5bc1", "parent": "914c", "parentPresent": true, "name": "GET", "kind": "client", "service": "orders", "startMs": 0.4, "durMs": 22.4, "status": "unset"},
    {"id": "b41f", "parent": "9712", "parentPresent": true, "name": "GET /stock", "kind": "server", "service": "inventory", "startMs": 0.6, "durMs": 21.7, "status": "unset"},
    {"id": "1ebd", "parent": "b41f", "parentPresent": true, "name": "SELECT stock", "kind": "client", "service": "inventory", "startMs": 0.6, "durMs": 21.6, "status": "unset"},
    {"id": "8186", "parent": "5bc1", "parentPresent": true, "name": "GET /stock", "kind": "server", "service": "inventory", "startMs": 0.7, "durMs": 21.8, "status": "unset"},
    {"id": "9e61", "parent": "8186", "parentPresent": true, "name": "SELECT stock", "kind": "client", "service": "inventory", "startMs": 0.7, "durMs": 21.6, "status": "unset"},
  ],
  "missing-parent": [
    {"id": "5c1e", "parent": "2397", "parentPresent": false, "name": "GET", "kind": "client", "service": "gateway", "startMs": 0.0, "durMs": 22.8, "status": "unset"},
    {"id": "499c", "parent": "5c1e", "parentPresent": true, "name": "GET /orders", "kind": "server", "service": "orders", "startMs": 0.3, "durMs": 22.0, "status": "unset"},
    {"id": "8f18", "parent": "499c", "parentPresent": true, "name": "GET", "kind": "client", "service": "orders", "startMs": 0.4, "durMs": 21.9, "status": "unset"},
    {"id": "bfb5", "parent": "8f18", "parentPresent": true, "name": "GET /stock", "kind": "server", "service": "inventory", "startMs": 0.8, "durMs": 21.0, "status": "unset"},
    {"id": "9530", "parent": "bfb5", "parentPresent": true, "name": "SELECT stock", "kind": "client", "service": "inventory", "startMs": 0.9, "durMs": 21.0, "status": "unset"},
  ],
};
