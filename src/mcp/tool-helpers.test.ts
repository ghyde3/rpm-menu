import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { apiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys/hash";
import { assertScope, McpScopeError, runTool, type McpToolContext } from "./tool-helpers";
import { McpRateLimitError } from "./rate-limit";

describe("assertScope", () => {
  it("passes when every required scope is present", () => {
    expect(() => assertScope(["read", "write:items"], "read")).not.toThrow();
    expect(() => assertScope(["read", "write:items"], ["read", "write:items"])).not.toThrow();
  });

  it("throws McpScopeError naming the missing scope(s)", () => {
    expect(() => assertScope(["read"], "write:prices")).toThrow(McpScopeError);
    try {
      assertScope(["read"], ["read", "write:prices", "write:screens"]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(McpScopeError);
      expect((err as Error).message).toContain("write:prices");
      expect((err as Error).message).toContain("write:screens");
    }
  });
});

describe("runTool", () => {
  let db: Database;
  let apiKeyId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const generated = generateApiKey();
    const [row] = await db
      .insert(apiKeys)
      .values({ name: "Rate Limit Test Key", keyHash: generated.hash, scopes: ["read"] })
      .returning();
    apiKeyId = row.id;
  });

  function ctxFor(id: string): McpToolContext {
    return {
      db,
      caller: { actor: { type: "system", id }, surface: "mcp" },
      scopes: ["read"],
      apiKeyId: id,
    };
  }

  it("wraps a handler's return value as pretty-printed JSON text content", async () => {
    const result = await runTool(ctxFor(apiKeyId), async () => ({ ok: true, count: 3 }));
    expect(result.content).toHaveLength(1);
    expect(result.content?.[0]).toMatchObject({ type: "text" });
    const text = (result.content?.[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual({ ok: true, count: 3 });
  });

  it("propagates errors thrown by the handler", async () => {
    await expect(
      runTool(ctxFor(apiKeyId), async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("enforces the per-key rate limit before running the handler", async () => {
    const generated = generateApiKey();
    const [row] = await db
      .insert(apiKeys)
      .values({ name: "Rate Limited Key", keyHash: generated.hash, scopes: ["read"] })
      .returning();
    const ctx = ctxFor(row.id);

    let calls = 0;
    const handler = async () => {
      calls++;
      return { calls };
    };

    for (let i = 0; i < 120; i++) {
      await runTool(ctx, handler);
    }
    expect(calls).toBe(120);

    await expect(runTool(ctx, handler)).rejects.toBeInstanceOf(McpRateLimitError);
    // The 121st call never reached the handler.
    expect(calls).toBe(120);
  });
});
