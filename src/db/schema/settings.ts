// PRD §5.1 + §3.8: venue_settings is a singleton row. Owned by foundation
// (schema); each Settings tab's reads/writes live in its own
// src/lib/service/settings/<tab>.ts file (one per unit, per plan conventions).
import { check, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { images } from "./images";

export interface VenueSocialLinks {
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  [key: string]: string | undefined;
}

export interface VenueHours {
  [day: string]: { open?: string; close?: string; closed?: boolean } | undefined;
}

export interface CurrencyFormat {
  symbol?: string;
  showTrailingZeros?: { web?: boolean; display?: boolean };
}

export interface BrandingConfig {
  primaryColor?: string;
  accentColor?: string;
  font?: string;
}

export interface MenuBehaviorConfig {
  unavailableTreatment?: "hide" | "badge";
  showImages?: boolean;
  showPublicTagBadges?: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

/** Singleton row — enforced by a CHECK pinning `id` to a fixed sentinel
 * value rather than a second table/flag (single-tenant per PRD §1.3). */
export const venueSettings = pgTable(
  "venue_settings",
  {
    id: uuid("id").primaryKey().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
    name: text("name").notNull().default("RPM Pub"),
    logoImageId: uuid("logo_image_id").references(() => images.id, { onDelete: "set null" }),
    address: text("address"),
    phone: text("phone"),
    social: jsonb("social").$type<VenueSocialLinks>().notNull().default({}),
    hours: jsonb("hours").$type<VenueHours>().notNull().default({}),
    timezone: text("timezone").notNull().default("America/Chicago"),
    currencyFormat: jsonb("currency_format").$type<CurrencyFormat>().notNull().default({}),
    branding: jsonb("branding").$type<BrandingConfig>().notNull().default({}),
    menuBehavior: jsonb("menu_behavior").$type<MenuBehaviorConfig>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "venue_settings_singleton_check",
      sql`${table.id} = '00000000-0000-0000-0000-000000000001'::uuid`,
    ),
  ],
);

export const VENUE_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
