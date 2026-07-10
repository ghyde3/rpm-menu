import { describe, expect, it } from "vitest";
import { buildScriptSrc, buildContentSecurityPolicy } from "./csp";

describe("buildScriptSrc", () => {
  it("includes 'unsafe-eval' in development (Turbopack/React use eval() for fast-refresh)", () => {
    expect(buildScriptSrc("development")).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("includes 'unsafe-eval' for test/undefined envs too (any non-production)", () => {
    expect(buildScriptSrc("test")).toContain("'unsafe-eval'");
    expect(buildScriptSrc(undefined)).toContain("'unsafe-eval'");
  });

  it("NEVER includes 'unsafe-eval' in production — React never uses eval() in prod", () => {
    expect(buildScriptSrc("production")).toBe("script-src 'self' 'unsafe-inline'");
    expect(buildScriptSrc("production")).not.toContain("unsafe-eval");
  });
});

describe("buildContentSecurityPolicy", () => {
  it("production CSP omits unsafe-eval but keeps the hardening directives", () => {
    const csp = buildContentSecurityPolicy("production");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("development CSP allows unsafe-eval (only within script-src)", () => {
    const csp = buildContentSecurityPolicy("development");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    // The eval allowance must not leak into any other directive.
    const directives = csp.split("; ").filter((d) => d.includes("unsafe-eval"));
    expect(directives).toEqual(["script-src 'self' 'unsafe-inline' 'unsafe-eval'"]);
  });
});
