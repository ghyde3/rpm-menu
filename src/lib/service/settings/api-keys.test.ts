import { describe, expect, it, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { apiKeys, auditLog, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyApiKey } from "@/lib/api-keys/hash";
import { listApiKeys, createApiKey, revokeApiKey } from "./api-keys";
import { revertChange } from "../revert";
import type { ServiceCaller } from "../base";

function ownerCaller(id: string): ServiceCaller {
  return { actor: { type: "user", id }, surface: "admin_ui", role: "owner", isActive: true };
}
function staffCaller(id: string): ServiceCaller {
  return { actor: { type: "user", id }, surface: "admin_ui", role: "staff", isActive: true };
}

async function seedOwner(db: Database) {
  const [owner] = await db
    .insert(users)
    .values({ email: `owner-${randomUUID()}@rpmpub.example`, name: "Owner", role: "owner", emailVerified: true })
    .returning();
  return owner;
}

describe("api-keys service", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("creates a key, returning the plaintext once and persisting only its hash", async () => {
    const owner = await seedOwner(db);
    const { apiKey, plaintextKey } = await createApiKey(db, ownerCaller(owner.id), {
      name: "menu-bot",
      scopes: ["read", "write:availability"],
    });

    expect(apiKey.name).toBe("menu-bot");
    expect(apiKey.scopes).toEqual(["read", "write:availability"]);
    expect(apiKey.revokedAt).toBeNull();
    expect(apiKey).not.toHaveProperty("keyHash");
    expect(plaintextKey.startsWith("rpm_")).toBe(true);

    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, apiKey.id));
    expect(row.keyHash).not.toBe(plaintextKey);
    expect(verifyApiKey(plaintextKey, row.keyHash)).toBe(true);
  });

  it("normalizes/dedupes scopes into the fixed registry order", async () => {
    const owner = await seedOwner(db);
    const { apiKey } = await createApiKey(db, ownerCaller(owner.id), {
      name: "dup-scopes",
      scopes: ["write:prices", "read", "read"],
    });
    expect(apiKey.scopes).toEqual(["read", "write:prices"]);
  });

  it("rejects an empty scopes array", async () => {
    const owner = await seedOwner(db);
    await expect(createApiKey(db, ownerCaller(owner.id), { name: "no-scopes", scopes: [] })).rejects.toThrow();
  });

  it("rejects creation from a non-owner actor", async () => {
    const owner = await seedOwner(db);
    await expect(
      createApiKey(db, staffCaller(owner.id), { name: "nope", scopes: ["read"] }),
    ).rejects.toThrow();
  });

  it("lists keys newest-first without exposing key_hash", async () => {
    const owner = await seedOwner(db);
    const { apiKey: first } = await createApiKey(db, ownerCaller(owner.id), { name: "first", scopes: ["read"] });
    // Force a distinct `created_at` -- two inserts issued back-to-back can
    // otherwise land in the same millisecond (Date.now() resolution),
    // making "newest-first" ambiguous and this assertion flaky.
    await new Promise((r) => setTimeout(r, 5));
    const { apiKey: second } = await createApiKey(db, ownerCaller(owner.id), { name: "second", scopes: ["read"] });
    expect(second.createdAt.getTime()).toBeGreaterThanOrEqual(first.createdAt.getTime());

    const list = await listApiKeys(db, ownerCaller(owner.id));
    expect(list.map((k) => k.name)).toEqual(["second", "first"]);
    for (const k of list) expect(k).not.toHaveProperty("keyHash");
  });

  it("revokes a key, setting revoked_at", async () => {
    const owner = await seedOwner(db);
    const { apiKey } = await createApiKey(db, ownerCaller(owner.id), { name: "revoke-me", scopes: ["read"] });
    expect(apiKey.revokedAt).toBeNull();

    const revoked = await revokeApiKey(db, ownerCaller(owner.id), apiKey.id);
    expect(revoked.revokedAt).not.toBeNull();
  });

  it("refuses to revoke an already-revoked key", async () => {
    const owner = await seedOwner(db);
    const { apiKey } = await createApiKey(db, ownerCaller(owner.id), { name: "twice", scopes: ["read"] });
    await revokeApiKey(db, ownerCaller(owner.id), apiKey.id);
    await expect(revokeApiKey(db, ownerCaller(owner.id), apiKey.id)).rejects.toThrow();
  });

  it("throws NotFoundError revoking an unknown id", async () => {
    const owner = await seedOwner(db);
    await expect(revokeApiKey(db, ownerCaller(owner.id), randomUUID())).rejects.toThrow();
  });

  it("rejects revoke from a non-owner actor", async () => {
    const owner = await seedOwner(db);
    const { apiKey } = await createApiKey(db, ownerCaller(owner.id), { name: "staff-cant", scopes: ["read"] });
    await expect(revokeApiKey(db, staffCaller(owner.id), apiKey.id)).rejects.toThrow();
  });

  it("reverting a create deletes the row", async () => {
    const owner = await seedOwner(db);
    const { apiKey } = await createApiKey(db, ownerCaller(owner.id), { name: "to-revert", scopes: ["read"] });

    // create_api_key's audit row has `entity_id: null` at write time (every
    // domain's create mutation does -- see revert.ts's
    // `withBackfilledEntityId` doc) -- find it by action instead.
    const [auditRow] = await db.select().from(auditLog).where(eq(auditLog.action, "create_api_key"));
    expect(auditRow).toBeTruthy();

    await revertChange(db, ownerCaller(owner.id), auditRow.id);

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, apiKey.id));
    expect(rows).toHaveLength(0);
  });

  it("reverting a revoke restores revoked_at to null", async () => {
    const owner = await seedOwner(db);
    const { apiKey } = await createApiKey(db, ownerCaller(owner.id), { name: "unrevoke", scopes: ["read"] });
    await revokeApiKey(db, ownerCaller(owner.id), apiKey.id);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, apiKey.id));
    const revokeEntry = rows.find((r) => r.action === "revoke_api_key");
    expect(revokeEntry).toBeTruthy();

    await revertChange(db, ownerCaller(owner.id), revokeEntry!.id);

    const [after] = await db.select().from(apiKeys).where(eq(apiKeys.id, apiKey.id));
    expect(after.revokedAt).toBeNull();
  });
});
