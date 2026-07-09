// PRD §5.1 core catalog tables + addendum §2 modifications.
// Owned by foundation; CRUD/validation logic lives in the
// items-categories-tags unit (src/lib/service/items.ts etc.) — this file is
// schema only.
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { images } from "./images";

export const categoryTypeEnum = ["food", "drink"] as const;
export type CategoryType = (typeof categoryTypeEnum)[number];

export const tagVisibilityEnum = ["public", "private"] as const;
export type TagVisibility = (typeof tagVisibilityEnum)[number];

export const pricingTypeEnum = ["fixed", "ask_server", "tbd"] as const;
export type PricingType = (typeof pricingTypeEnum)[number];

export const priceVariantKindEnum = ["size", "happy_hour"] as const;
export type PriceVariantKind = (typeof priceVariantKindEnum)[number];

/** Curated typed-attribute registry (§3.1 + addendum §2) — code-defined enum,
 * not user-defined fields. Validated against this shape at the service
 * boundary (items-categories-tags owns the Zod schema). */
export interface ItemAttributes {
  abv?: number;
  ibu?: number;
  flavor_profile?: string;
  origin?: string;
  calories?: number;
  style?: string;
}

/** `display_config` on categories: attribute order + per-surface show/hide
 * (§3.1 Item Display Schema). Shape refined by items-categories-tags. */
export interface CategoryDisplayConfig {
  attributeOrder?: (keyof ItemAttributes)[];
  showDescription?: { web?: boolean; display?: boolean };
  showBadges?: boolean;
  [key: string]: unknown;
}

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type", { enum: categoryTypeEnum }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  displayConfig: jsonb("display_config").$type<CategoryDisplayConfig>().notNull().default({}),
  // addendum §2: display copy separate from canonical name, e.g. "★ Made to Share!"
  tagline: text("tagline"),
  imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  visibility: text("visibility", { enum: tagVisibilityEnum }).notNull().default("private"),
  icon: text("icon"),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    // addendum §2: nullable — unpriced items (TBD/ask-server) are real states.
    priceCents: integer("price_cents"),
    pricingType: text("pricing_type", { enum: pricingTypeEnum }).notNull().default("fixed"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    attributes: jsonb("attributes").$type<ItemAttributes>().notNull().default({}),
    // addendum §2: one holder per featured slot (e.g. drink_of_the_week).
    featuredSlotKey: text("featured_slot_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("items_featured_slot_key_unique")
      .on(table.featuredSlotKey)
      .where(sql`${table.featuredSlotKey} is not null`),
  ],
);

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.tagId] })],
);

export const itemPriceVariants = pgTable("item_price_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  priceCents: integer("price_cents").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  // addendum §2: replaces free-text label matching for happy hour.
  kind: text("kind", { enum: priceVariantKindEnum }).notNull().default("size"),
});

// Row types, used throughout the service layer + tests.
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ItemTag = typeof itemTags.$inferSelect;
export type ItemPriceVariant = typeof itemPriceVariants.$inferSelect;
