import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { apiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys/hash";
import { authenticateMcpServer, McpAuthError } from "./auth";

async function insertKey(db: Database, overrides: { scopes?: string[]; revoked?: boolean; name?: string } = {}) {
  const generated = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({
      name: overrides.name ?? "MCP Test Key",
      keyHash: generated.hash,
      scopes: overrides.scopes ?? ["read"],
      revokedAt: overrides.revoked ? new Date() : null,
    })
    .returning();
  return { row, plaintext: generated.plaintext };
}

describe("authenticateMcpServer", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("rejects when MCP_API_KEY is missing/blank", async () => {
    await expect(authenticateMcpServer(db, undefined)).rejects.toBeInstanceOf(McpAuthError);
    await expect(authenticateMcpServer(db, "   ")).rejects.toBeInstanceOf(McpAuthError);
  });

  it("rejects an unknown key", async () => {
    await expect(authenticateMcpServer(db, "rpm_not-a-real-key")).rejects.toThrow(/does not match/);
  });

  it("rejects a revoked key", async () => {
    const { plaintext } = await insertKey(db, { revoked: true });
    await expect(authenticateMcpServer(db, plaintext)).rejects.toThrow(/revoked/);
  });

  it("authenticates a valid key and derives a system/mcp ServiceCaller", async () => {
    const { row, plaintext } = await insertKey(db, { scopes: ["read", "write:availability"], name: "Menu Bot" });
    const identity = await authenticateMcpServer(db, plaintext);

    expect(identity.apiKeyId).toBe(row.id);
    expect(identity.apiKeyName).toBe("Menu Bot");
    expect(identity.scopes).toEqual(["read", "write:availability"]);
    expect(identity.caller).toEqual({ actor: { type: "system", id: row.id }, surface: "mcp" });
  });

  it("bumps last_used_at on successful auth", async () => {
    const { row, plaintext } = await insertKey(db, { scopes: ["read"] });
    expect(row.lastUsedAt).toBeNull();

    await authenticateMcpServer(db, plaintext);

    const [after] = await db.select().from(apiKeys).where(eq(apiKeys.id, row.id));
    expect(after.lastUsedAt).not.toBeNull();
  });
});
