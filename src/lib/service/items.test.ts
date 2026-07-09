import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories, items } from "@/db/schema";
import {
  createItem,
  updateItem,
  deleteItem,
  setItemAvailability,
  setFeaturedSlot,
  clearFeaturedSlot,
} from "./items";
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
});
