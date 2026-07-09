// PRD §5.1 + §3.2: screen definitions + manual-mode item ordering.
// Owned by foundation (schema); CRUD/templates/preview live in the screens
// unit (src/lib/service/screens.ts, src/components/screens/**).
import { integer, pgTable, jsonb, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { items } from "./catalog";

export const screenTemplateEnum = ["list", "grid", "spotlight"] as const;
export type ScreenTemplate = (typeof screenTemplateEnum)[number];

export const screenSourceModeEnum = ["query", "manual"] as const;
export type ScreenSourceMode = (typeof screenSourceModeEnum)[number];

/** `source_config` for query mode (PRD §5.1 notes). */
export interface ScreenSourceConfig {
  tagIds?: string[];
  categoryIds?: string[];
  orderBy?: string;
}

/** Per-screen rendering knobs (§3.2): title/accent/font-scale/columns,
 * per-surface show/hide toggles, overflow pagination interval, and the
 * happy-hour price-variant flag (addendum §2: `price_mode = 'happy_hour'`). */
export interface ScreenDisplayOptions {
  title?: string;
  accentColor?: string;
  fontScale?: number;
  columns?: number;
  showDescriptions?: boolean;
  showBadges?: boolean;
  showAttributes?: boolean;
  unavailableTreatment?: "hide" | "badge";
  paginationIntervalSeconds?: number;
  priceMode?: "standard" | "happy_hour";
  [key: string]: unknown;
}

export const screens = pgTable("screens", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  template: text("template", { enum: screenTemplateEnum }).notNull().default("list"),
  sourceMode: text("source_mode", { enum: screenSourceModeEnum }).notNull().default("query"),
  sourceConfig: jsonb("source_config").$type<ScreenSourceConfig>().notNull().default({}),
  displayOptions: jsonb("display_options").$type<ScreenDisplayOptions>().notNull().default({}),
  backgroundImageKey: text("background_image_key"),
  // Bumped on any content-affecting change (§5.3); displays poll this.
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Manual-mode explicit ordered item list (§3.2). */
export const screenItems = pgTable(
  "screen_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screens.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("screen_items_screen_item_unique").on(table.screenId, table.itemId)],
);
