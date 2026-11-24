import { describe, expect, it } from "vitest";
import { isGithubAuthorizeUrl, loginUrl, safeNext } from "./login";

describe("safeNext (return path)", () => {
  it("keeps same-origin /app paths, query and hash", () => {
    for (const v of ["/app", "/app/", "/app/traces", "/app/traces/abc?span=1#x", "/app?range=6h", "/app/services/a%20b"]) expect(safeNext(v), v).toBe(v);
  });
  it("rejects everything else and falls back to /app", () => {
    const bad = [
      undefined, "", "/", "/demo", "/login", "/application", "/apps/x", "app", "https://evil.example/app", "//evil.example/app", "/\\evil.example",
      "/app\\..\\x", "/app\n/x", "/app\r\nSet-Cookie:x", "/app x", "javascript:alert(1)", "/app/../login", "/app%2f..%2f", "x".repeat(600), " /app",
    ];
    for (const v of bad) expect(safeNext(v as string), String(v)).toBe(v !== undefined && /^\/app\/\.\.\/login$/.test(String(v)) ? "/app" : "/app");
  });
  it("uses the first value of a repeated param", () => {
    expect(safeNext(["/app/map", "//x"])).toBe("/app/map");
    expect(safeNext(["//x", "/app/map"])).toBe("/app");
  });
  it("loginUrl encodes the safe path and optional reason", () => {
    expect(loginUrl("/app/traces?x=1")).toBe("/login?next=%2Fapp%2Ftraces%3Fx%3D1");
    expect(loginUrl("//evil", "expired")).toBe("/login?next=%2Fapp&reason=expired");
  });
});

describe("isGithubAuthorizeUrl", () => {
  it("accepts only https github.com", () => {
    expect(isGithubAuthorizeUrl("https://github.com/login/oauth/authorize?client_id=x")).toBe(true);
    for (const v of ["http://github.com/x", "https://github.com.evil.example/x", "https://evil.example/github.com", "javascript:1", "", null, 5]) expect(isGithubAuthorizeUrl(v), String(v)).toBe(false);
  });
});
