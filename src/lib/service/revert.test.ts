import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories, items, itemTags, users } from "@/db/schema";
import { createItem, updateItem, setItemAvailability, setItemTags } from "./items";
import { createCategory, updateCategory } from "./categories";
import { createTag } from "./tags";
import { previewBulkOperation, applyBulkOperation } from "./bulk-ops";
import { listRecentChanges, listChangeActors, revertChange, revertBulkGroup } from "./revert";
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

describe("revert service", () => {
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

  describe("single-entity revert", () => {
    it("reverts an availability toggle (staff-permitted)", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Wings", categoryId: category.id, priceCents: 900 });
      await setItemAvailability(db, owner, item.id, { isAvailable: false });

      const changes = await listRecentChanges(db, owner, { entityType: "item" });
      const toggleEntry = changes.find((c) => c.action === "set_item_availability" && c.entityId === item.id)!;
      expect(toggleEntry).toBeTruthy();

      await revertChange(db, staff, toggleEntry.id);
      const [reverted] = await db.select().from(items).where(eq(items.id, item.id));
      expect(reverted.isAvailable).toBe(true);
    });

    it("requires owner to revert a price change, even though staff can revert other item edits", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Reuben", categoryId: category.id, priceCents: 1000 });
      await updateItem(db, owner, item.id, { priceCents: 1200 });

      const changes = await listRecentChanges(db, owner, { entityType: "item" });
      const priceEntry = changes.find(
        (c) => c.action === "update_item" && c.entityId === item.id,
      )!;

      await expect(revertChange(db, staff, priceEntry.id)).rejects.toThrow();

      await revertChange(db, owner, priceEntry.id);
      const [reverted] = await db.select().from(items).where(eq(items.id, item.id));
      expect(reverted.priceCents).toBe(1000);
    });

    it("requires owner to revert a create (undo = delete, mirrors delete being owner-only)", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, staff, { name: "Mystery Snack", categoryId: category.id });

      const changes = await listRecentChanges(db, owner, { entityType: "item" });
      const createEntry = changes.find((c) => c.action === "create_item" && c.entityId === item.id)!;

      await expect(revertChange(db, staff, createEntry.id)).rejects.toThrow();
      await revertChange(db, owner, createEntry.id);

      const rows = await db.select().from(items).where(eq(items.id, item.id));
      expect(rows).toHaveLength(0);
    });

    it("restores item_tags membership when reverting a set_item_tags change (items.ts's registered handler genuinely restores it, not a no-op)", async () => {
      const category = await seedCategory(db);
      const tag = await createTag(db, owner, { name: "spicy", visibility: "public" });
      const item = await createItem(db, owner, { name: "Buffalo Wings", categoryId: category.id });
      await setItemTags(db, owner, item.id, { tagIds: [tag.id] });

      const changes = await listRecentChanges(db, owner, { entityType: "item" });
      const tagEntry = changes.find((c) => c.action === "set_item_tags" && c.entityId === item.id)!;

      await revertChange(db, staff, tagEntry.id);

      const rows = await db.select().from(itemTags).where(eq(itemTags.itemId, item.id));
      expect(rows).toHaveLength(0);
    });

    it("restores the exact prior tag set (not just empties it) when reverting a second set_item_tags change", async () => {
      const category = await seedCategory(db);
      const tagA = await createTag(db, owner, { name: "gluten-free-salad", visibility: "public" });
      const tagB = await createTag(db, owner, { name: "vegan-salad", visibility: "public" });
      const item = await createItem(db, owner, { name: "Garden Salad", categoryId: category.id });

      await setItemTags(db, owner, item.id, { tagIds: [tagA.id] });
      await setItemTags(db, owner, item.id, { tagIds: [tagA.id, tagB.id] });

      const changes = await listRecentChanges(db, owner, { entityType: "item" });
      const secondTagEntry = changes.find(
        (c) => c.action === "set_item_tags" && c.entityId === item.id && (c.before as { tagIds: string[] }).tagIds.length === 1,
      )!;
      expect(secondTagEntry).toBeTruthy();

      await revertChange(db, staff, secondTagEntry.id);

      const rows = await db.select({ tagId: itemTags.tagId }).from(itemTags).where(eq(itemTags.itemId, item.id));
      expect(rows.map((r) => r.tagId).sort()).toEqual([tagA.id]);
    });

    it("gates category reverts as staff-or-owner", async () => {
      const category = await createCategory(db, owner, { name: "Apps", type: "food" });
      await updateCategory(db, staff, category.id, { name: "Appetizers" });

      const changes = await listRecentChanges(db, owner, { entityType: "category" });
      const entry = changes.find((c) => c.action === "update_category" && c.entityId === category.id)!;
      await revertChange(db, staff, entry.id);

      const [reverted] = await db.select().from(categories).where(eq(categories.id, category.id));
      expect(reverted.name).toBe("Apps");
    });

    it("gates tag reverts as owner-only (tag definitions are owner-managed)", async () => {
      const tag = await createTag(db, owner, { name: "vegan", visibility: "public" });
      const changes = await listRecentChanges(db, owner, { entityType: "tag" });
      const entry = changes.find((c) => c.action === "create_tag" && c.entityId === tag.id)!;

      await expect(revertChange(db, staff, entry.id)).rejects.toThrow();
      await revertChange(db, owner, entry.id);
    });
  });

  describe("bulk-group revert", () => {
    it("reverts every row from one bulk-availability apply as a group", async () => {
      const category = await seedCategory(db);
      const a = await createItem(db, owner, { name: "A", categoryId: category.id, isAvailable: true });
      const b = await createItem(db, owner, { name: "B", categoryId: category.id, isAvailable: true });

      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_set_availability",
        itemIds: [a.id, b.id],
        isAvailable: false,
      });
      await applyBulkOperation(db, staff, preview.pendingChangeId);

      const result = await revertBulkGroup(db, staff, preview.pendingChangeId);
      expect(result.revertedCount).toBe(2);

      const [revertedA] = await db.select().from(items).where(eq(items.id, a.id));
      const [revertedB] = await db.select().from(items).where(eq(items.id, b.id));
      expect(revertedA.isAvailable).toBe(true);
      expect(revertedB.isAvailable).toBe(true);
    });

    it("requires owner to revert a bulk price-adjust group", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Draft", categoryId: category.id, priceCents: 600 });
      const preview = await previewBulkOperation(db, owner, {
        changeType: "bulk_price_adjust",
        itemIds: [item.id],
        mode: "flat",
        amountCents: 100,
      });
      await applyBulkOperation(db, owner, preview.pendingChangeId);

      await expect(revertBulkGroup(db, staff, preview.pendingChangeId)).rejects.toThrow();

      const result = await revertBulkGroup(db, owner, preview.pendingChangeId);
      expect(result.revertedCount).toBe(1);
      const [reverted] = await db.select().from(items).where(eq(items.id, item.id));
      expect(reverted.priceCents).toBe(600);
    });

    it("refuses to revert a group that was never applied", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Cider", categoryId: category.id, isAvailable: true });
      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_set_availability",
        itemIds: [item.id],
        isAvailable: false,
      });
      await expect(revertBulkGroup(db, staff, preview.pendingChangeId)).rejects.toThrow();
    });
  });

  describe("listRecentChanges / listChangeActors", () => {
    it("filters by actor id and paginates most-recent-first", async () => {
      const category = await seedCategory(db);
      await createItem(db, owner, { name: "Owner Item", categoryId: category.id });
      await createItem(db, staff, { name: "Staff Item", categoryId: category.id });

      const ownerOnly = await listRecentChanges(db, owner, { actorId: owner.actor.id! });
      expect(ownerOnly.every((c) => c.actorId === owner.actor.id)).toBe(true);
      expect(ownerOnly.some((c) => c.action === "create_item")).toBe(true);
    });

    it("marks bulk-group entries with a parsed bulkGroup", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Group Item", categoryId: category.id, isAvailable: true });
      const preview = await previewBulkOperation(db, staff, {
        changeType: "bulk_set_availability",
        itemIds: [item.id],
        isAvailable: false,
      });
      await applyBulkOperation(db, staff, preview.pendingChangeId);

      const changes = await listRecentChanges(db, owner, { entityType: "item" });
      const entry = changes.find((c) => c.entityId === item.id && c.action.startsWith("bulk_set_availability:"))!;
      expect(entry.bulkGroup).toEqual({ changeType: "bulk_set_availability", pendingChangeId: preview.pendingChangeId });
    });

    it("lists users as candidate change actors", async () => {
      const actors = await listChangeActors(db, owner);
      expect(Array.isArray(actors)).toBe(true);
    });
  });
});
