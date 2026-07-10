import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { apiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys/hash";
import { ApiAuthError, authenticateApiRequest } from "./auth-middleware";

function makeRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new NextRequest("https://example.com/api/v1/items", { headers });
}

async function insertKey(
  db: Database,
  overrides: { scopes?: string[]; revoked?: boolean; name?: string } = {},
) {
  const generated = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({
      name: overrides.name ?? "Test Key",
      keyHash: generated.hash,
      scopes: overrides.scopes ?? ["read"],
      revokedAt: overrides.revoked ? new Date() : null,
    })
    .returning();
  return { row, plaintext: generated.plaintext };
}

describe("authenticateApiRequest", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("rejects a request with no Authorization header", async () => {
    await expect(authenticateApiRequest(db, makeRequest(), { scope: "read" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects a malformed Authorization header", async () => {
    const headers = new Headers({ authorization: "Basic abc123" });
    const req = new NextRequest("https://example.com/api/v1/items", { headers });
    await expect(authenticateApiRequest(db, req, { scope: "read" })).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an unknown key", async () => {
    await expect(
      authenticateApiRequest(db, makeRequest("rpm_totally-not-a-real-key"), { scope: "read" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a revoked key", async () => {
    const { plaintext } = await insertKey(db, { revoked: true });
    await expect(authenticateApiRequest(db, makeRequest(plaintext), { scope: "read" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects a key missing the required scope", async () => {
    const { plaintext } = await insertKey(db, { scopes: ["read"] });
    await expect(
      authenticateApiRequest(db, makeRequest(plaintext), { scope: "write:prices" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects when only some of multiple required scopes are present", async () => {
    const { plaintext } = await insertKey(db, { scopes: ["read", "write:items"] });
    await expect(
      authenticateApiRequest(db, makeRequest(plaintext), { scope: ["write:items", "write:prices"] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("authenticates a valid key with the required scope and returns a system actor caller", async () => {
    const { row, plaintext } = await insertKey(db, { scopes: ["read", "write:availability"], name: "Menu Bot" });
    const result = await authenticateApiRequest(db, makeRequest(plaintext), { scope: "write:availability" });

    expect(result.apiKeyId).toBe(row.id);
    expect(result.apiKeyName).toBe("Menu Bot");
    expect(result.scopes).toEqual(["read", "write:availability"]);
    expect(result.caller).toEqual({ actor: { type: "system", id: row.id }, surface: "api" });
  });

  it("bumps last_used_at on successful auth", async () => {
    const { row, plaintext } = await insertKey(db, { scopes: ["read"] });
    expect(row.lastUsedAt).toBeNull();

    await authenticateApiRequest(db, makeRequest(plaintext), { scope: "read" });

    const [after] = await db.select().from(apiKeys).where(eq(apiKeys.id, row.id));
    expect(after.lastUsedAt).not.toBeNull();
  });

  it("enforces the per-key rate limit and rejects once the limit is exceeded", async () => {
    const { plaintext } = await insertKey(db, { scopes: ["read"] });
    const options = { scope: "read" as const, rateLimit: { windowSeconds: 60, limit: 2 } };

    await authenticateApiRequest(db, makeRequest(plaintext), options);
    await authenticateApiRequest(db, makeRequest(plaintext), options);

    await expect(authenticateApiRequest(db, makeRequest(plaintext), options)).rejects.toMatchObject({
      status: 429,
    });
  });

  it("rate limits independently per key", async () => {
    const keyA = await insertKey(db, { scopes: ["read"] });
    const keyB = await insertKey(db, { scopes: ["read"] });
    const options = { scope: "read" as const, rateLimit: { windowSeconds: 60, limit: 1 } };

    await authenticateApiRequest(db, makeRequest(keyA.plaintext), options);
    await expect(authenticateApiRequest(db, makeRequest(keyA.plaintext), options)).rejects.toMatchObject({
      status: 429,
    });
    // A different key's own bucket is untouched.
    await expect(authenticateApiRequest(db, makeRequest(keyB.plaintext), options)).resolves.toBeDefined();
  });

  it("ApiAuthError carries the status and message it was constructed with", () => {
    const err = new ApiAuthError(429, "slow down");
    expect(err.status).toBe(429);
    expect(err.message).toBe("slow down");
    expect(err.name).toBe("ApiAuthError");
  });
});
