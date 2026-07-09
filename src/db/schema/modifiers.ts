// Addendum §1: modifier groups/options/attachments/exclusions.
// Owned by foundation (schema); CRUD + the ambiguous-pricing fail-safe live
// in the modifiers unit (src/lib/service/modifiers.ts).
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { items, categories } from "./catalog";

export const modifierSelectionTypeEnum = ["single", "multiple"] as const;
export type ModifierSelectionType = (typeof modifierSelectionTypeEnum)[number];

export const modifierPricingModeEnum = ["included", "delta", "replacement", "ambiguous"] as const;
export type ModifierPricingMode = (typeof modifierPricingModeEnum)[number];

export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    selectionType: text("selection_type", { enum: modifierSelectionTypeEnum }).notNull(),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select"),
    isRequired: boolean("is_required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("modifier_groups_selection_type_check", sql`${table.selectionType} in ('single','multiple')`),
  ],
);

/** Fail-safe rule (hard requirement, addendum §1): the shared render helper
 * (owned by items-categories-tags: src/lib/menu/display-line.ts) must refuse
 * to display a price for `pricing_mode = 'ambiguous'`. `price_delta_cents`
 * stays NULL until a human resolves it via the two explicit admin buttons. */
export const modifierOptions = pgTable(
  "modifier_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    linkedItemId: uuid("linked_item_id").references(() => items.id, { onDelete: "set null" }),
    pricingMode: text("pricing_mode", { enum: modifierPricingModeEnum }).notNull().default("ambiguous"),
    priceDeltaCents: integer("price_delta_cents"),
    replacementPriceCents: integer("replacement_price_cents"),
    rawPriceText: text("raw_price_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isAvailable: boolean("is_available").notNull().default(true),
  },
  (table) => [
    check(
      "modifier_options_pricing_mode_check",
      sql`${table.pricingMode} in ('included','delta','replacement','ambiguous')`,
    ),
  ],
);

export const modifierGroupAttachments = pgTable(
  "modifier_group_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    check(
      "modifier_group_attachments_target_check",
      sql`(${table.itemId} is not null) <> (${table.categoryId} is not null)`,
    ),
  ],
);

/** Lets one item drop a single option from an inherited category-level group
 * without forking the group (addendum §1). */
export const itemModifierOptionExclusions = pgTable(
  "item_modifier_option_exclusions",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => modifierOptions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.optionId] })],
);
