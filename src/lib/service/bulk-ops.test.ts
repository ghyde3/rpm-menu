import { describe, expect, it, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { auditLog, categories, items, itemTags, tags, users } from "@/db/schema";
import { previewBulkOperation, applyBulkOperation } from "./bulk-ops";
import type { ServiceCaller } from "./base";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000aa" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

const staff: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000bb" },
  surface: "admin_ui",
  role: "staff",
  isActive: true,
};

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

async function seedTag(db: Database, name: string) {
  const [tag] = await db.insert(tags).values({ name, visibility: "private" }).returning();
  return tag;
}

describe("bulk-ops service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
    // pending_changes.actor_id FKs to users.id -- seed matching rows for
    // every fixed test-caller id used below.
    await db.insert(users).values([
      { id: owner.actor.id!, email: "owner@test.local", name: "Owner", role: "owner" },
      { id: staff.actor.id!, email: "staff@test.local", name: "Staff", role: "staff" },
    ]);
  });

  describe("bulk_set_availability", () => {
    it("previews a diff, then applies it, skipping items already in the target state", async () => {
      const category = await seedCategory(db);
      const a = await seedItem(db, category.id, { name: "A", isAvailable: true });
      const b = await seedItem(db, category.id, { name: "B", isAvailable: false });

      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_set_availability",
        itemIds: [a.id, b.id],
        isAvailable: false,
      });
      expect(preview.diff).toHaveLength(2);
      const aRow = preview.diff.find((d) => d.itemId === a.id)!;
      const bRow = preview.diff.find((d) => d.itemId === b.id)!;
      expect(aRow.skipped).toBe(false);
      expect(bRow.skipped).toBe(true);

      const result = await applyBulkOperation(db, staff, preview.pendingChangeId);
      expect(result.appliedCount).toBe(1);
      expect(result.skippedCount).toBe(1);

      const [updatedA] = await db.select().from(items).where(eq(items.id, a.id));
      expect(updatedA.isAvailable).toBe(false);

      const auditRows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, `bulk_set_availability:${preview.pendingChangeId}`));
      expect(auditRows).toHaveLength(1);
      expect(auditRows[0].entityId).toBe(a.id);
    });

    it("staff may preview and apply an availability bulk op", async () => {
      const category = await seedCategory(db);
      const item = await seedItem(db, category.id, { isAvailable: true });
      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_set_availability",
        itemIds: [item.id],
        isAvailable: false,
      });
      const result = await applyBulkOperation(db, staff, preview.pendingChangeId);
      expect(result.appliedCount).toBe(1);
    });
  });

  describe("bulk_set_category", () => {
    it("moves items to a new category", async () => {
      const from = await seedCategory(db, "From");
      const to = await seedCategory(db, "To");
      const item = await seedItem(db, from.id);

      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_set_category",
        itemIds: [item.id],
        categoryId: to.id,
      });
      expect(preview.diff[0].skipped).toBe(false);

      const result = await applyBulkOperation(db, staff, preview.pendingChangeId);
      expect(result.appliedCount).toBe(1);

      const [updated] = await db.select().from(items).where(eq(items.id, item.id));
      expect(updated.categoryId).toBe(to.id);
    });
  });

  describe("bulk_tag", () => {
    it("adds a tag to items that don't have it yet, skipping ones that do", async () => {
      const category = await seedCategory(db);
      const tag = await seedTag(db, "happy-hour-eligible");
      const untagged = await seedItem(db, category.id, { name: "Untagged" });
      const tagged = await seedItem(db, category.id, { name: "Tagged" });
      await db.insert(itemTags).values({ itemId: tagged.id, tagId: tag.id });

      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_tag",
        itemIds: [untagged.id, tagged.id],
        tagId: tag.id,
        action: "add",
      });
      const untaggedDiff = preview.diff.find((d) => d.itemId === untagged.id)!;
      const taggedDiff = preview.diff.find((d) => d.itemId === tagged.id)!;
      expect(untaggedDiff.skipped).toBe(false);
      expect(taggedDiff.skipped).toBe(true);

      const result = await applyBulkOperation(db, staff, preview.pendingChangeId);
      expect(result.appliedCount).toBe(1);
      expect(result.skippedCount).toBe(1);

      const rows = await db
        .select()
        .from(itemTags)
        .where(and(eq(itemTags.itemId, untagged.id), eq(itemTags.tagId, tag.id)));
      expect(rows).toHaveLength(1);
    });

    it("removes a tag from items that have it", async () => {
      const category = await seedCategory(db);
      const tag = await seedTag(db, "special");
      const item = await seedItem(db, category.id);
      await db.insert(itemTags).values({ itemId: item.id, tagId: tag.id });

      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_tag",
        itemIds: [item.id],
        tagId: tag.id,
        action: "remove",
      });
      await applyBulkOperation(db, staff, preview.pendingChangeId);

      const rows = await db
        .select()
        .from(itemTags)
        .where(and(eq(itemTags.itemId, item.id), eq(itemTags.tagId, tag.id)));
      expect(rows).toHaveLength(0);
    });
  });

  describe("bulk_price_adjust", () => {
    it("applies a flat delta to fixed-price items", async () => {
      const category = await seedCategory(db);
      const item = await seedItem(db, category.id, { priceCents: 1000 });

      const preview = await previewBulkOperation(db, owner, {
        changeType: "bulk_price_adjust",
        itemIds: [item.id],
        mode: "flat",
        amountCents: 150,
      });
      expect(preview.diff[0].after.priceCents).toBe(1150);

      await applyBulkOperation(db, owner, preview.pendingChangeId);
      const [updated] = await db.select().from(items).where(eq(items.id, item.id));
      expect(updated.priceCents).toBe(1150);
    });

    it("applies a percent adjustment rounded to the nearest cent", async () => {
      const category = await seedCategory(db);
      const item = await seedItem(db, category.id, { priceCents: 999 });

      const preview = await previewBulkOperation(db, owner, {
        changeType: "bulk_price_adjust",
        itemIds: [item.id],
        mode: "percent",
        percent: 10,
      });
      // 999 * 1.10 = 1098.9 -> rounds to 1099
      expect(preview.diff[0].after.priceCents).toBe(1099);
    });

    it("addendum §5.4: skips non-fixed-price items (ask_server/tbd/null price) entirely", async () => {
      const category = await seedCategory(db);
      const askServer = await seedItem(db, category.id, { priceCents: null, pricingType: "ask_server" });
      const tbd = await seedItem(db, category.id, { priceCents: null, pricingType: "tbd" });
      const fixed = await seedItem(db, category.id, { priceCents: 500, pricingType: "fixed" });

      const preview = await previewBulkOperation(db, owner, {
        changeType: "bulk_price_adjust",
        itemIds: [askServer.id, tbd.id, fixed.id],
        mode: "flat",
        amountCents: 100,
      });
      expect(preview.diff.find((d) => d.itemId === askServer.id)!.skipped).toBe(true);
      expect(preview.diff.find((d) => d.itemId === tbd.id)!.skipped).toBe(true);
      expect(preview.diff.find((d) => d.itemId === fixed.id)!.skipped).toBe(false);

      const result = await applyBulkOperation(db, owner, preview.pendingChangeId);
      expect(result.appliedCount).toBe(1);
      expect(result.skippedCount).toBe(2);

      const [askServerAfter] = await db.select().from(items).where(eq(items.id, askServer.id));
      expect(askServerAfter.priceCents).toBeNull();
    });

    it("skips an adjustment that would go negative", async () => {
      const category = await seedCategory(db);
      const item = await seedItem(db, category.id, { priceCents: 100 });
      const preview = await previewBulkOperation(db, owner, {
        changeType: "bulk_price_adjust",
        itemIds: [item.id],
        mode: "flat",
        amountCents: -500,
      });
      expect(preview.diff[0].skipped).toBe(true);
      expect(preview.diff[0].reason).toMatch(/negative/);
    });

    it("PRD §2: staff cannot preview or apply a price adjust", async () => {
      const category = await seedCategory(db);
      const item = await seedItem(db, category.id, { priceCents: 500 });
      await expect(
        previewBulkOperation(db, staff, {
          changeType: "bulk_price_adjust",
          itemIds: [item.id],
          mode: "flat",
          amountCents: 100,
        }),
      ).rejects.toThrow();
    });
  });

  describe("expiry + re-apply guards", () => {
    it("refuses to apply an expired preview", async () => {
      const category = await seedCategory(db);
      const item = await seedItem(db, category.id);
      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_set_availability",
        itemIds: [item.id],
        isAvailable: false,
      });
      // Simulate expiry by applying, then trying to apply the same (now
      // "applied") pending change again -- covers the non-"pending" guard
      // shared with the real expiry path (see pending-changes.test.ts for
      // the expiry-specific coverage).
      await applyBulkOperation(db, staff, preview.pendingChangeId);
      await expect(applyBulkOperation(db, staff, preview.pendingChangeId)).rejects.toThrow();
    });

    it("rejects an unknown item id at preview time", async () => {
      await expect(
        previewBulkOperation(db, staff, {
          changeType: "bulk_set_availability",
          itemIds: ["00000000-0000-0000-0000-000000000000"],
          isAvailable: false,
        }),
      ).rejects.toThrow();
    });
  });
});
