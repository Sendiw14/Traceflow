// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { authMode, parseAllowlist, sessionTooOld } from "./config";

const good = {
  TRACEFLOW_PUBLIC_URL: "https://traceflow.example",
  TRACEFLOW_AUTH_SECRET: "x".repeat(40),
  TRACEFLOW_AUTH_DATABASE_URL: "postgres://traceflow_auth:pw@postgres:5432/traceflow_auth",
  GITHUB_CLIENT_ID: "id",
  GITHUB_CLIENT_SECRET: "secret",
  TRACEFLOW_OPERATOR_GITHUB_IDS: "1001, 2002",
};

describe("authMode", () => {
  it("bootstrap only in local-dev, none in public-demo or unknown", () => {
    expect(authMode("local-dev", {}).kind).toBe("bootstrap");
    expect(authMode("public-demo", good).kind).toBe("none");
    expect(authMode(null, good).kind).toBe("none");
  });
  it("operator-prod with complete env uses GitHub with numeric allowlist", () => {
    const m = authMode("operator-prod", good);
    expect(m.kind).toBe("github");
    if (m.kind === "github") expect([...m.config.allowlist]).toEqual(["1001", "2002"]);
  });
  it.each([
    ["missing secret", { ...good, TRACEFLOW_AUTH_SECRET: "" }],
    ["short secret", { ...good, TRACEFLOW_AUTH_SECRET: "short" }],
    ["http url", { ...good, TRACEFLOW_PUBLIC_URL: "http://traceflow.example" }],
    ["url with path", { ...good, TRACEFLOW_PUBLIC_URL: "https://traceflow.example/app" }],
    ["username instead of id", { ...good, TRACEFLOW_OPERATOR_GITHUB_IDS: "alice" }],
    ["empty allowlist", { ...good, TRACEFLOW_OPERATOR_GITHUB_IDS: " , " }],
    ["missing client secret", { ...good, GITHUB_CLIENT_SECRET: undefined }],
  ])("operator-prod fails closed: %s", (_name, env) => {
    expect(authMode("operator-prod", env).kind).toBe("misconfigured");
  });
});

describe("parseAllowlist", () => {
  it("accepts only positive decimal IDs", () => {
    expect(parseAllowlist("1, 02, 3x, 4").bad).toEqual(["02", "3x"]);
  });
});

describe("sessionTooOld", () => {
  it("enforces the 7-day absolute cap", () => {
    const now = new Date("2026-11-25T00:00:00Z");
    expect(sessionTooOld(new Date("2026-11-18T00:00:01Z"), now)).toBe(false);
    expect(sessionTooOld(new Date("2026-11-17T23:59:59Z"), now)).toBe(true);
  });
});
