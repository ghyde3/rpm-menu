import { describe, expect, it, beforeAll } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { auditLog, categories, images, items, itemImages } from "@/db/schema";
import {
  addItemImage,
  removeItemImage,
  reorderItemImages,
  setPrimaryItemImage,
  listItemImages,
  listItemImagesForItems,
} from "./item-images";
import { revertAuditEntry } from "./base/audit";
import type { ServiceCaller } from "./base";
import { AuthError } from "@/lib/auth/role-guard";

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

const noRole: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000cc" },
  surface: "admin_ui",
  role: undefined,
  isActive: true,
};

async function seedCategory(db: Database) {
  const [category] = await db.insert(categories).values({ name: "Drinks", type: "drink" }).returning();
  return category;
}

async function seedItem(db: Database, categoryId: string, name = "House Lager") {
  const [item] = await db.insert(items).values({ name, categoryId }).returning();
  return item;
}

async function seedImage(db: Database, key = "images/fixture") {
  const [image] = await db
    .insert(images)
    .values({ key, variants: { thumb: `${key}/thumb.webp`, card: `${key}/card.webp`, display: `${key}/display.webp` } })
    .returning();
  return image;
}

async function getItemImageId(db: Database, itemId: string): Promise<string | null> {
  const [row] = await db.select({ imageId: items.imageId }).from(items).where(eq(items.id, itemId));
  return row?.imageId ?? null;
}

describe("item-images service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("first added image becomes primary and syncs items.imageId; second does not", async () => {
    const category = await seedCategory(db);
    const item = await seedItem(db, category.id);
    const imageA = await seedImage(db, "images/a");
    const imageB = await seedImage(db, "images/b");

    const afterFirst = await addItemImage(db, staff, item.id, { imageId: imageA.id });
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].isPrimary).toBe(true);
    expect(afterFirst[0].imageId).toBe(imageA.id);
    expect(afterFirst[0].key).toBe("images/a");
    expect(await getItemImageId(db, item.id)).toBe(imageA.id);

    const afterSecond = await addItemImage(db, staff, item.id, { imageId: imageB.id });
    expect(afterSecond).toHaveLength(2);
    const second = afterSecond.find((e) => e.imageId === imageB.id)!;
    expect(second.isPrimary).toBe(false);
    expect(second.sortOrder).toBe(1);
    // Hero pointer is untouched by a non-primary add.
    expect(await getItemImageId(db, item.id)).toBe(imageA.id);

    await expect(addItemImage(db, noRole, item.id, { imageId: imageB.id })).rejects.toThrow(AuthError);
  });

  it("setPrimaryItemImage swaps primary as a single transaction and re-syncs items.imageId", async () => {
    const category = await seedCategory(db);
    const item = await seedItem(db, category.id);
    const imageA = await seedImage(db, "images/set-a");
    const imageB = await seedImage(db, "images/set-b");

    await addItemImage(db, staff, item.id, { imageId: imageA.id });
    const gallery = await addItemImage(db, staff, item.id, { imageId: imageB.id });
    const secondEntry = gallery.find((e) => e.imageId === imageB.id)!;

    const afterSwap = await setPrimaryItemImage(db, staff, item.id, { itemImageId: secondEntry.id });

    const primaries = afterSwap.filter((e) => e.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].imageId).toBe(imageB.id);
    expect(await getItemImageId(db, item.id)).toBe(imageB.id);

    // Exactly one row flagged primary in the DB too (not just in the
    // returned view) -- confirms the clear-then-set ran as one transaction.
    const dbPrimaries = await db
      .select()
      .from(itemImages)
      .where(eq(itemImages.itemId, item.id));
    expect(dbPrimaries.filter((r) => r.isPrimary)).toHaveLength(1);
  });

  it("removing the primary image promotes the next by sortOrder and re-syncs items.imageId", async () => {
    const category = await seedCategory(db);
    const item = await seedItem(db, category.id);
    const imageA = await seedImage(db, "images/rm-a");
    const imageB = await seedImage(db, "images/rm-b");
    const imageC = await seedImage(db, "images/rm-c");

    const first = await addItemImage(db, staff, item.id, { imageId: imageA.id });
    await addItemImage(db, staff, item.id, { imageId: imageB.id });
    await addItemImage(db, staff, item.id, { imageId: imageC.id });

    const primaryEntry = first[0]; // imageA, sortOrder 0, isPrimary true
    const afterRemove = await removeItemImage(db, staff, item.id, { itemImageId: primaryEntry.id });

    expect(afterRemove).toHaveLength(2);
    const promoted = afterRemove.find((e) => e.isPrimary);
    expect(promoted?.imageId).toBe(imageB.id); // lowest remaining sortOrder
    expect(await getItemImageId(db, item.id)).toBe(imageB.id);

    // Remove the rest -> gallery empty -> hero pointer clears to null.
    for (const entry of afterRemove) {
      await removeItemImage(db, staff, item.id, { itemImageId: entry.id });
    }
    expect(await listItemImages(db, item.id)).toHaveLength(0);
    expect(await getItemImageId(db, item.id)).toBeNull();
  });

  it("reorderItemImages persists the new sortOrder and rejects a membership mismatch", async () => {
    const category = await seedCategory(db);
    const item = await seedItem(db, category.id);
    const imageA = await seedImage(db, "images/ord-a");
    const imageB = await seedImage(db, "images/ord-b");
    const imageC = await seedImage(db, "images/ord-c");

    await addItemImage(db, staff, item.id, { imageId: imageA.id });
    await addItemImage(db, staff, item.id, { imageId: imageB.id });
    const gallery = await addItemImage(db, staff, item.id, { imageId: imageC.id });
    const [a, b, c] = gallery.sort((x, y) => x.sortOrder - y.sortOrder);

    const reordered = await reorderItemImages(db, owner, item.id, {
      orderedItemImageIds: [c.id, a.id, b.id],
    });
    expect(reordered.map((e) => e.imageId)).toEqual([imageC.id, imageA.id, imageB.id]);

    await expect(
      reorderItemImages(db, staff, item.id, { orderedItemImageIds: [a.id, b.id] }),
    ).rejects.toThrow(/gallery membership/);
  });

  it("deleting the item cascades its gallery rows", async () => {
    const category = await seedCategory(db);
    const item = await seedItem(db, category.id);
    const image = await seedImage(db, "images/cascade");
    await addItemImage(db, staff, item.id, { imageId: image.id });

    await db.delete(items).where(eq(items.id, item.id));

    const rows = await db.select().from(itemImages).where(eq(itemImages.itemId, item.id));
    expect(rows).toHaveLength(0);
  });

  it("reverting a set-primary audit row restores the prior gallery state", async () => {
    const category = await seedCategory(db);
    const item = await seedItem(db, category.id);
    const imageA = await seedImage(db, "images/rev-a");
    const imageB = await seedImage(db, "images/rev-b");

    await addItemImage(db, staff, item.id, { imageId: imageA.id });
    const gallery = await addItemImage(db, staff, item.id, { imageId: imageB.id });
    const secondEntry = gallery.find((e) => e.imageId === imageB.id)!;

    await setPrimaryItemImage(db, staff, item.id, { itemImageId: secondEntry.id });
    expect(await getItemImageId(db, item.id)).toBe(imageB.id);

    const [setPrimaryAudit] = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, "item_image"),
          eq(auditLog.entityId, item.id),
          eq(auditLog.action, "set_primary_item_image"),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    expect(setPrimaryAudit).toBeDefined();

    await revertAuditEntry(db, setPrimaryAudit.id, { actor: staff.actor, surface: staff.surface });

    const restored = await listItemImages(db, item.id);
    const restoredPrimary = restored.find((e) => e.isPrimary);
    expect(restoredPrimary?.imageId).toBe(imageA.id);
    expect(await getItemImageId(db, item.id)).toBe(imageA.id);
  });

  it("reverting an add-image audit row removes the added row and restores the prior primary", async () => {
    const category = await seedCategory(db);
    const item = await seedItem(db, category.id);
    const imageA = await seedImage(db, "images/rev2-a");
    const imageB = await seedImage(db, "images/rev2-b");

    await addItemImage(db, staff, item.id, { imageId: imageA.id });
    await addItemImage(db, staff, item.id, { imageId: imageB.id });

    const [addAudit] = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, "item_image"),
          eq(auditLog.entityId, item.id),
          eq(auditLog.action, "add_item_image"),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    expect(addAudit).toBeDefined();

    await revertAuditEntry(db, addAudit.id, { actor: staff.actor, surface: staff.surface });

    const restored = await listItemImages(db, item.id);
    expect(restored).toHaveLength(1);
    expect(restored[0].imageId).toBe(imageA.id);
    expect(restored[0].isPrimary).toBe(true);
    expect(await getItemImageId(db, item.id)).toBe(imageA.id);
  });

  it("the partial unique index rejects a second primary row for the same item", async () => {
    const category = await seedCategory(db);
    const item = await seedItem(db, category.id);
    const imageA = await seedImage(db, "images/uniq-a");
    const imageB = await seedImage(db, "images/uniq-b");

    await db.insert(itemImages).values({ itemId: item.id, imageId: imageA.id, sortOrder: 0, isPrimary: true });

    await expect(
      db.insert(itemImages).values({ itemId: item.id, imageId: imageB.id, sortOrder: 1, isPrimary: true }),
    ).rejects.toThrow();
  });

  it("listItemImagesForItems batches galleries for multiple items in one call", async () => {
    const category = await seedCategory(db);
    const itemOne = await seedItem(db, category.id, "Batch Item 1");
    const itemTwo = await seedItem(db, category.id, "Batch Item 2");
    const imageA = await seedImage(db, "images/batch-a");
    const imageB = await seedImage(db, "images/batch-b");

    await addItemImage(db, staff, itemOne.id, { imageId: imageA.id });
    await addItemImage(db, staff, itemTwo.id, { imageId: imageB.id });

    const map = await listItemImagesForItems(db, [itemOne.id, itemTwo.id, "00000000-0000-0000-0000-000000000000"]);
    expect(map.get(itemOne.id)).toHaveLength(1);
    expect(map.get(itemOne.id)?.[0].imageId).toBe(imageA.id);
    expect(map.get(itemTwo.id)).toHaveLength(1);
    expect(map.has("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});
