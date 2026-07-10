import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { auditLog, categories, itemTags, items } from "@/db/schema";
import {
  createItem,
  updateItem,
  deleteItem,
  setItemAvailability,
  setItemTags,
  setFeaturedSlot,
  clearFeaturedSlot,
  createItemPriceVariant,
  updateItemPriceVariant,
  deleteItemPriceVariant,
} from "./items";
import { revertAuditEntry } from "./base/audit";
import { createTag } from "./tags";
import type { ServiceCaller } from "./base";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000aa" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

async function seedCategory(db: Database) {
  const [category] = await db.insert(categories).values({ name: "Drinks", type: "drink" }).returning();
  return category;
}

describe("items service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("creates, updates, toggles availability, and deletes an item", async () => {
    const category = await seedCategory(db);

    const created = await createItem(db, owner, {
      name: "House Lager",
      categoryId: category.id,
      priceCents: 600,
      pricingType: "fixed",
    });
    expect(created.name).toBe("House Lager");
    expect(created.isAvailable).toBe(true);

    const updated = await updateItem(db, owner, created.id, { priceCents: 650 });
    expect(updated.priceCents).toBe(650);

    const toggled = await setItemAvailability(db, owner, created.id, { isAvailable: false });
    expect(toggled.isAvailable).toBe(false);

    await deleteItem(db, owner, created.id);
    const rows = await db.select().from(items).where(eq(items.id, created.id));
    expect(rows).toHaveLength(0);
  });

  it("rejects a mutation from a non-staff/owner user actor", async () => {
    const category = await seedCategory(db);
    const noRole: ServiceCaller = {
      actor: { type: "user", id: "00000000-0000-0000-0000-0000000000bb" },
      surface: "admin_ui",
      role: undefined,
      isActive: true,
    };
    await expect(
      createItem(db, noRole, { name: "Nope", categoryId: category.id }),
    ).rejects.toThrow();
  });

  describe("role restrictions (PRD §2: staff cannot change prices or delete items)", () => {
    const staff: ServiceCaller = {
      actor: { type: "user", id: "00000000-0000-0000-0000-0000000000cc" },
      surface: "admin_ui",
      role: "staff",
      isActive: true,
    };

    it("lets staff create a priceless item but not one with a price", async () => {
      const category = await seedCategory(db);
      const created = await createItem(db, staff, { name: "Mystery Snack", categoryId: category.id });
      expect(created.priceCents).toBeNull();

      await expect(
        createItem(db, staff, { name: "Priced Snack", categoryId: category.id, priceCents: 500 }),
      ).rejects.toThrow();
    });

    it("lets staff edit an item's description but not its price", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Wings", categoryId: category.id, priceCents: 900 });

      const updated = await updateItem(db, staff, item.id, { description: "Extra saucy" });
      expect(updated.description).toBe("Extra saucy");

      await expect(updateItem(db, staff, item.id, { priceCents: 1000 })).rejects.toThrow();
      await expect(updateItem(db, staff, item.id, { pricingType: "ask_server" })).rejects.toThrow();
    });

    it("lets staff toggle availability (the one-tap 86 action)", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Fries", categoryId: category.id });
      const toggled = await setItemAvailability(db, staff, item.id, { isAvailable: false });
      expect(toggled.isAvailable).toBe(false);
    });

    it("refuses a staff delete", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Burger", categoryId: category.id });
      await expect(deleteItem(db, staff, item.id)).rejects.toThrow();
    });

    it("refuses staff price-variant CRUD", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Reuben", categoryId: category.id });
      await expect(
        createItemPriceVariant(db, staff, { itemId: item.id, label: "Half", priceCents: 800 }),
      ).rejects.toThrow();

      const variant = await createItemPriceVariant(db, owner, {
        itemId: item.id,
        label: "Half",
        priceCents: 800,
      });
      await expect(
        updateItemPriceVariant(db, staff, variant.id, { priceCents: 850 }),
      ).rejects.toThrow();
      await expect(deleteItemPriceVariant(db, staff, variant.id)).rejects.toThrow();
    });
  });

  describe("createItemPriceVariant: happy-hour uniqueness", () => {
    it("allows the first happy_hour variant for an item", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "House Lager", categoryId: category.id });
      const variant = await createItemPriceVariant(db, owner, {
        itemId: item.id,
        label: "Happy Hour",
        priceCents: 500,
        kind: "happy_hour",
      });
      expect(variant.kind).toBe("happy_hour");
    });

    it("rejects a second happy_hour variant for the same item (QA fix: was previously allowed, producing two rows a resolver query could non-deterministically pick between)", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "House IPA", categoryId: category.id });
      await createItemPriceVariant(db, owner, {
        itemId: item.id,
        label: "Happy Hour",
        priceCents: 500,
        kind: "happy_hour",
      });

      await expect(
        createItemPriceVariant(db, owner, {
          itemId: item.id,
          label: "Happy Hour (again)",
          priceCents: 700,
          kind: "happy_hour",
        }),
      ).rejects.toThrow();
    });

    it("still allows multiple `size` variants for the same item (the uniqueness rule is happy_hour-only)", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Pretzel", categoryId: category.id });
      await createItemPriceVariant(db, owner, { itemId: item.id, label: "Half", priceCents: 600, kind: "size" });
      const second = await createItemPriceVariant(db, owner, {
        itemId: item.id,
        label: "Full",
        priceCents: 1100,
        kind: "size",
      });
      expect(second.kind).toBe("size");
    });

    it("allows two different items to each have their own happy_hour variant", async () => {
      const category = await seedCategory(db);
      const first = await createItem(db, owner, { name: "Well Whiskey", categoryId: category.id });
      const second = await createItem(db, owner, { name: "Well Vodka", categoryId: category.id });
      await createItemPriceVariant(db, owner, { itemId: first.id, label: "Happy Hour", priceCents: 400, kind: "happy_hour" });
      const secondVariant = await createItemPriceVariant(db, owner, {
        itemId: second.id,
        label: "Happy Hour",
        priceCents: 450,
        kind: "happy_hour",
      });
      expect(secondVariant.kind).toBe("happy_hour");
    });
  });

  describe("setFeaturedSlot", () => {
    it("is a single-transaction swap: assigning a slot to a new item clears the previous holder", async () => {
      const category = await seedCategory(db);
      const first = await createItem(db, owner, { name: "The Ginny Runner", categoryId: category.id });
      const second = await createItem(db, owner, { name: "Old Fashioned", categoryId: category.id });

      const firstFeatured = await setFeaturedSlot(db, owner, first.id, {
        featuredSlotKey: "drink_of_the_week",
      });
      expect(firstFeatured.featuredSlotKey).toBe("drink_of_the_week");

      const secondFeatured = await setFeaturedSlot(db, owner, second.id, {
        featuredSlotKey: "drink_of_the_week",
      });
      expect(secondFeatured.featuredSlotKey).toBe("drink_of_the_week");

      // Exactly one holder — the partial unique index invariant.
      const [firstRow] = await db.select().from(items).where(eq(items.id, first.id));
      expect(firstRow.featuredSlotKey).toBeNull();

      const holders = await db
        .select()
        .from(items)
        .where(eq(items.featuredSlotKey, "drink_of_the_week"));
      expect(holders).toHaveLength(1);
      expect(holders[0].id).toBe(second.id);
    });

    it("is idempotent when reassigning the slot to its current holder", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Dessert of the Day", categoryId: category.id });

      await setFeaturedSlot(db, owner, item.id, { featuredSlotKey: "dessert_of_the_day" });
      const reassigned = await setFeaturedSlot(db, owner, item.id, { featuredSlotKey: "dessert_of_the_day" });
      expect(reassigned.featuredSlotKey).toBe("dessert_of_the_day");

      const holders = await db
        .select()
        .from(items)
        .where(eq(items.featuredSlotKey, "dessert_of_the_day"));
      expect(holders).toHaveLength(1);
    });

    it("clearFeaturedSlot frees the slot for another item to claim", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Seasonal Ale", categoryId: category.id });
      await setFeaturedSlot(db, owner, item.id, { featuredSlotKey: "beer_of_the_month" });

      const cleared = await clearFeaturedSlot(db, owner, item.id);
      expect(cleared.featuredSlotKey).toBeNull();

      const holders = await db
        .select()
        .from(items)
        .where(eq(items.featuredSlotKey, "beer_of_the_month"));
      expect(holders).toHaveLength(0);
    });

    it("never leaves two items holding the same slot even under two concurrent assignments", async () => {
      const category = await seedCategory(db);
      const a = await createItem(db, owner, { name: "A", categoryId: category.id });
      const b = await createItem(db, owner, { name: "B", categoryId: category.id });

      await Promise.all([
        setFeaturedSlot(db, owner, a.id, { featuredSlotKey: "concurrent_slot" }),
        setFeaturedSlot(db, owner, b.id, { featuredSlotKey: "concurrent_slot" }),
      ]);

      const holders = await db.select().from(items).where(eq(items.featuredSlotKey, "concurrent_slot"));
      expect(holders).toHaveLength(1);
    });
  });

  describe("revert (registered \"item\" handler)", () => {
    it("create_item's audit row already carries the real entity_id (no null entity_id, no separate backfill)", async () => {
      const category = await seedCategory(db);
      const created = await createItem(db, owner, { name: "Nachos", categoryId: category.id });

      const [row] = await db.select().from(auditLog).where(eq(auditLog.entityId, created.id));
      expect(row).toBeTruthy();
      expect(row.action).toBe("create_item");
      expect(row.entityId).toBe(created.id);
    });

    it("reverts a create_item audit row through the generic dispatcher directly (delete)", async () => {
      const category = await seedCategory(db);
      const created = await createItem(db, owner, { name: "Loaded Fries", categoryId: category.id });

      const [row] = await db.select().from(auditLog).where(eq(auditLog.entityId, created.id));
      await revertAuditEntry(db, row.id, { actor: owner.actor, surface: "admin_ui" });

      const rows = await db.select().from(items).where(eq(items.id, created.id));
      expect(rows).toHaveLength(0);
    });

    it("restores item_tags membership (not a no-op) when a set_item_tags audit row is reverted through the generic dispatcher", async () => {
      const category = await seedCategory(db);
      const item = await createItem(db, owner, { name: "Pretzel Bites", categoryId: category.id });
      await setItemTags(db, owner, item.id, { tagIds: [] }); // baseline: no tags
      const beforeSecondSet = await db.select().from(itemTags).where(eq(itemTags.itemId, item.id));
      expect(beforeSecondSet).toHaveLength(0);

      const tag = await createTag(db, owner, { name: "pretzel-tag", visibility: "public" });
      await setItemTags(db, owner, item.id, { tagIds: [tag.id] });

      const auditRows = await db.select().from(auditLog).where(eq(auditLog.entityId, item.id));
      const tagSetRows = auditRows.filter((r) => r.action === "set_item_tags");
      const tagSetRow = tagSetRows[tagSetRows.length - 1];
      expect(tagSetRow).toBeTruthy();

      await revertAuditEntry(db, tagSetRow.id, { actor: owner.actor, surface: "admin_ui" });

      const rows = await db.select().from(itemTags).where(eq(itemTags.itemId, item.id));
      expect(rows).toHaveLength(0); // reverted back to the empty baseline
    });
  });
});
