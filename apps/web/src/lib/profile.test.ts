import { describe, expect, it } from "vitest";
import { allows, areaOf, parseProfile } from "./profile";

describe("profile gating", () => {
  it("parses only the three known profiles", () => {
    expect(parseProfile("local-dev")).toBe("local-dev");
    for (const v of [undefined, "", "prod", "Public-Demo", "local-dev "]) expect(parseProfile(v)).toBeNull();
  });
  it("matches the authorization matrix", () => {
    expect([allows("local-dev", "app"), allows("local-dev", "demo"), allows("local-dev", "login")]).toEqual([true, true, false]);
    expect([allows("operator-prod", "app"), allows("operator-prod", "demo"), allows("operator-prod", "login")]).toEqual([true, false, true]);
    expect([allows("public-demo", "app"), allows("public-demo", "demo"), allows("public-demo", "login")]).toEqual([false, true, false]);
  });
  it("fails closed when the profile is missing or unknown", () => {
    expect(allows(parseProfile(undefined), "app")).toBe(false);
    expect(allows(parseProfile("nope"), "demo")).toBe(false);
  });
  it("classifies paths without prefix confusion", () => {
    expect(areaOf("/app")).toBe("app");
    expect(areaOf("/app/traces/x")).toBe("app");
    expect(areaOf("/demo")).toBe("demo");
    expect(areaOf("/demo/traces/x")).toBe("demo");
    expect(areaOf("/login")).toBe("login");
    for (const p of ["/", "/docs", "/application", "/demonstration", "/apps", "/loginx"]) expect(areaOf(p)).toBeNull();
  });
});
