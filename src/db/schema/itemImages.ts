// Multi-photo gallery per menu item (M4 addendum: items keep a single
// denormalized `imageId` "hero" pointer for existing render paths, but can
// now carry an ordered gallery of many images, exactly one of which is
// flagged primary). Owned by the item-images unit; CRUD/validation logic
// lives in src/lib/service/item-images.ts — this file is schema only.
import { boolean, index, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { items } from "./catalog";
import { images } from "./images";

export const itemImages = pgTable(
  "item_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("item_images_item_id_idx").on(table.itemId),
    // Mirrors items.items_featured_slot_key_unique /
    // item_price_variants_one_happy_hour_per_item's partial-unique-index
    // precedent: "at most one primary per item," enforced in the DB so a
    // read-then-write race (two admin tabs setting primary concurrently)
    // can't ever leave two rows flagged primary for the same item.
    uniqueIndex("item_images_one_primary_per_item")
      .on(table.itemId)
      .where(sql`${table.isPrimary}`),
  ],
);

export type ItemImage = typeof itemImages.$inferSelect;
