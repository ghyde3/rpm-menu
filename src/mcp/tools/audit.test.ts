import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories, items } from "@/db/schema";
import { setAvailability } from "./items";
import { getRecentChanges } from "./audit";
import { McpScopeError } from "../tool-helpers";
import type { McpToolContext } from "../tool-helpers";

const API_KEY_ID = "00000000-0000-0000-0000-0000000000dd";

function ctxWithScopes(db: Database, scopes: string[]): McpToolContext {
  return {
    db,
    caller: { actor: { type: "system", id: API_KEY_ID }, surface: "mcp" },
    scopes: scopes as McpToolContext["scopes"],
    apiKeyId: API_KEY_ID,
  };
}

async function seedCategory(db: Database, name = "Drinks") {
  const [category] = await db.insert(categories).values({ name, type: "drink" }).returning();
  return category;
}

async function seedItem(db: Database, categoryId: string, overrides: Partial<typeof items.$inferInsert> = {}) {
  const [item] = await db
    .insert(items)
    .values({ name: "Item", categoryId, priceCents: 500, pricingType: "fixed", isAvailable: true, ...overrides })
    .returning();
  return item;
}

describe("mcp tools/audit", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("requires the read scope", async () => {
    await expect(getRecentChanges(ctxWithScopes(db, []), {})).rejects.toBeInstanceOf(McpScopeError);
  });

  it("surfaces mcp-surface, system-actor mutations in the feed", async () => {
    const category = await seedCategory(db, "Audit Category");
    const item = await seedItem(db, category.id, { isAvailable: true });
    await setAvailability(ctxWithScopes(db, ["write:availability"]), { itemId: item.id, isAvailable: false });

    const result = await getRecentChanges(ctxWithScopes(db, ["read"]), { entityType: "item" });
    const entry = result.entries.find((e) => e.entityId === item.id);
    expect(entry).toBeDefined();
    expect(entry?.actorType).toBe("system");
    expect(entry?.actorId).toBe(API_KEY_ID);
    expect(entry?.surface).toBe("mcp");
    expect(entry?.action).toBe("set_item_availability");
  });

  it("respects the limit/offset pagination params", async () => {
    const category = await seedCategory(db, "Pagination Category");
    for (let i = 0; i < 3; i++) {
      const item = await seedItem(db, category.id, { name: `Pagination Item ${i}` });
      await setAvailability(ctxWithScopes(db, ["write:availability"]), { itemId: item.id, isAvailable: false });
    }

    const page1 = await getRecentChanges(ctxWithScopes(db, ["read"]), { limit: 1, offset: 0 });
    const page2 = await getRecentChanges(ctxWithScopes(db, ["read"]), { limit: 1, offset: 1 });
    expect(page1.entries).toHaveLength(1);
    expect(page2.entries).toHaveLength(1);
    expect(page1.entries[0].id).not.toBe(page2.entries[0].id);
  });
});
