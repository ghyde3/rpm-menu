import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { auditLog, categories, items } from "@/db/schema";
import { searchItems, setAvailability, updateItem, list86d } from "./items";
import { McpScopeError } from "../tool-helpers";
import type { McpToolContext } from "../tool-helpers";

const API_KEY_ID = "00000000-0000-0000-0000-0000000000aa";

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

describe("mcp tools/items", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  describe("searchItems", () => {
    it("requires the read scope", async () => {
      await expect(searchItems(ctxWithScopes(db, []), {})).rejects.toBeInstanceOf(McpScopeError);
    });

    it("filters by name text and pages results", async () => {
      const category = await seedCategory(db, "Search Category");
      await seedItem(db, category.id, { name: "House Lager" });
      await seedItem(db, category.id, { name: "IPA Special" });

      const result = await searchItems(ctxWithScopes(db, ["read"]), { q: "lager" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("House Lager");
    });

    it("filters by categoryId and isAvailable", async () => {
      const category = await seedCategory(db, "Filter Category");
      const other = await seedCategory(db, "Other Category");
      await seedItem(db, category.id, { name: "Available Item", isAvailable: true });
      await seedItem(db, category.id, { name: "Unavailable Item", isAvailable: false });
      await seedItem(db, other.id, { name: "Elsewhere Item" });

      const result = await searchItems(ctxWithScopes(db, ["read"]), {
        categoryId: category.id,
        isAvailable: true,
      });
      expect(result.items.map((i) => i.name)).toEqual(["Available Item"]);
    });
  });

  describe("setAvailability", () => {
    it("requires the write:availability scope", async () => {
      const category = await seedCategory(db, "Scope Category");
      const item = await seedItem(db, category.id);
      await expect(
        setAvailability(ctxWithScopes(db, ["read"]), { itemId: item.id, isAvailable: false }),
      ).rejects.toBeInstanceOf(McpScopeError);
    });

    it("is single-step: toggles availability and writes an audit row", async () => {
      const category = await seedCategory(db, "86 Category");
      const item = await seedItem(db, category.id, { isAvailable: true });

      const result = await setAvailability(ctxWithScopes(db, ["write:availability"]), {
        itemId: item.id,
        isAvailable: false,
      });
      expect(result.item.isAvailable).toBe(false);

      const [row] = await db.select().from(items).where(eq(items.id, item.id));
      expect(row.isAvailable).toBe(false);

      const [audit] = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, item.id));
      expect(audit.action).toBe("set_item_availability");
      expect(audit.actorType).toBe("system");
      expect(audit.actorId).toBe(API_KEY_ID);
      expect(audit.surface).toBe("mcp");
    });
  });

  describe("updateItem", () => {
    it("requires write:items", async () => {
      const category = await seedCategory(db, "Update Category");
      const item = await seedItem(db, category.id);
      await expect(
        updateItem(ctxWithScopes(db, ["read"]), { itemId: item.id, name: "New Name" }),
      ).rejects.toBeInstanceOf(McpScopeError);
    });

    it("allows non-price fields with write:items alone", async () => {
      const category = await seedCategory(db, "Update Category 2");
      const item = await seedItem(db, category.id);

      const result = await updateItem(ctxWithScopes(db, ["write:items"]), {
        itemId: item.id,
        name: "Renamed Item",
      });
      expect(result.item.name).toBe("Renamed Item");
    });

    it("requires write:prices in addition to write:items when touching priceCents", async () => {
      const category = await seedCategory(db, "Update Category 3");
      const item = await seedItem(db, category.id);

      await expect(
        updateItem(ctxWithScopes(db, ["write:items"]), { itemId: item.id, priceCents: 700 }),
      ).rejects.toBeInstanceOf(McpScopeError);

      const result = await updateItem(ctxWithScopes(db, ["write:items", "write:prices"]), {
        itemId: item.id,
        priceCents: 700,
      });
      expect(result.item.priceCents).toBe(700);
    });

    it("requires write:prices when touching pricingType even without priceCents", async () => {
      const category = await seedCategory(db, "Update Category 4");
      const item = await seedItem(db, category.id);

      await expect(
        updateItem(ctxWithScopes(db, ["write:items"]), { itemId: item.id, pricingType: "ask_server" }),
      ).rejects.toBeInstanceOf(McpScopeError);
    });
  });

  describe("list86d", () => {
    it("requires the read scope", async () => {
      await expect(list86d(ctxWithScopes(db, []), {})).rejects.toBeInstanceOf(McpScopeError);
    });

    it("only ever returns unavailable items regardless of input", async () => {
      const category = await seedCategory(db, "86d Category");
      await seedItem(db, category.id, { name: "Still Available", isAvailable: true });
      const gone = await seedItem(db, category.id, { name: "All Gone", isAvailable: false });

      const result = await list86d(ctxWithScopes(db, ["read"]), {});
      expect(result.items.map((i) => i.id)).toContain(gone.id);
      expect(result.items.every((i) => i.isAvailable === false)).toBe(true);
    });
  });
});
