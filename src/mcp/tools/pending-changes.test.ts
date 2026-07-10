import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories, items } from "@/db/schema";
import { previewPriceAdjustment, applyPendingChange } from "./pending-changes";
import { getPendingChange } from "@/lib/service/pending-changes";
import { McpScopeError } from "../tool-helpers";
import type { McpToolContext } from "../tool-helpers";

const API_KEY_ID = "00000000-0000-0000-0000-0000000000bb";

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

describe("mcp tools/pending-changes", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  describe("previewPriceAdjustment", () => {
    it("requires write:prices", async () => {
      const category = await seedCategory(db, "Preview Scope");
      const item = await seedItem(db, category.id);
      await expect(
        previewPriceAdjustment(ctxWithScopes(db, ["read"]), {
          itemIds: [item.id],
          mode: "flat",
          amountCents: 50,
        }),
      ).rejects.toBeInstanceOf(McpScopeError);
    });

    it("writes nothing to items -- only a pending_changes row -- and returns a diff + id", async () => {
      const category = await seedCategory(db, "Preview Category");
      const item = await seedItem(db, category.id, { priceCents: 500 });

      const result = await previewPriceAdjustment(ctxWithScopes(db, ["write:prices"]), {
        itemIds: [item.id],
        mode: "flat",
        amountCents: 50,
      });

      expect(result.preview.pendingChangeId).toBeTruthy();
      expect(result.preview.diff[0]).toMatchObject({ itemId: item.id, skipped: false });

      const [unchanged] = await db.select().from(items).where(eq(items.id, item.id));
      expect(unchanged.priceCents).toBe(500);

      const pending = await getPendingChange(db, result.preview.pendingChangeId);
      expect(pending.status).toBe("pending");
      expect(pending.changeType).toBe("bulk_price_adjust");
    });
  });

  describe("applyPendingChange", () => {
    it("only accepts a server-issued pendingChangeId (unknown id -> NotFoundError)", async () => {
      await expect(
        applyPendingChange(ctxWithScopes(db, ["write:prices"]), {
          pendingChangeId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow();
    });

    it("requires the scope matching the previewed change's type, checked dynamically", async () => {
      const category = await seedCategory(db, "Apply Scope Category");
      const item = await seedItem(db, category.id, { priceCents: 500 });

      const preview = await previewPriceAdjustment(ctxWithScopes(db, ["write:prices"]), {
        itemIds: [item.id],
        mode: "flat",
        amountCents: 50,
      });

      // A key with only `read` (no write:prices) can't apply a price-adjust
      // pending change, even though applying doesn't require an up-front
      // static scope the way previewing does.
      await expect(
        applyPendingChange(ctxWithScopes(db, ["read"]), { pendingChangeId: preview.preview.pendingChangeId }),
      ).rejects.toBeInstanceOf(McpScopeError);
    });

    it("applies the previewed price adjustment end to end", async () => {
      const category = await seedCategory(db, "Apply Category");
      const item = await seedItem(db, category.id, { priceCents: 500 });

      const preview = await previewPriceAdjustment(ctxWithScopes(db, ["write:prices"]), {
        itemIds: [item.id],
        mode: "flat",
        amountCents: 100,
      });

      const applied = await applyPendingChange(ctxWithScopes(db, ["write:prices"]), {
        pendingChangeId: preview.preview.pendingChangeId,
      });
      expect(applied.result.appliedCount).toBe(1);

      const [updated] = await db.select().from(items).where(eq(items.id, item.id));
      expect(updated.priceCents).toBe(600);
    });

    it("rejects applying the same pending change twice", async () => {
      const category = await seedCategory(db, "Double Apply Category");
      const item = await seedItem(db, category.id, { priceCents: 500 });

      const preview = await previewPriceAdjustment(ctxWithScopes(db, ["write:prices"]), {
        itemIds: [item.id],
        mode: "flat",
        amountCents: 25,
      });
      const ctx = ctxWithScopes(db, ["write:prices"]);
      await applyPendingChange(ctx, { pendingChangeId: preview.preview.pendingChangeId });

      await expect(applyPendingChange(ctx, { pendingChangeId: preview.preview.pendingChangeId })).rejects.toThrow();
    });
  });
});
