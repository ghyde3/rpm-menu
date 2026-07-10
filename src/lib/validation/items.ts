// Zod schemas for src/lib/service/items.ts. Single validation source of
// truth for item mutations across admin UI / REST / MCP (§3.6).
import { z } from "zod";
import { pricingTypeEnum, priceVariantKindEnum } from "@/db/schema";
import { nullableCentsSchema, uuidSchema } from "./base";

/** Curated typed-attribute registry (§3.1 + addendum §2). `.strict()` so no
 * arbitrary keys ever reach the DB via `items.attributes` jsonb. */
export const itemAttributesSchema = z
  .object({
    abv: z.number().min(0).max(100).optional(),
    ibu: z.number().min(0).max(200).optional(),
    flavor_profile: z.string().min(1).max(200).optional(),
    origin: z.string().min(1).max(200).optional(),
    calories: z.number().int().min(0).optional(),
    style: z.string().min(1).max(100).optional(),
  })
  .strict();

const featuredSlotKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9_]+$/, "featuredSlotKey must be lowercase snake_case");

export const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  priceCents: nullableCentsSchema.optional(),
  pricingType: z.enum(pricingTypeEnum).default("fixed"),
  categoryId: uuidSchema,
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  imageId: uuidSchema.nullable().optional(),
  aliases: z.array(z.string().min(1).max(200)).default([]),
  attributes: itemAttributesSchema.default({}),
});
export type CreateItemInput = z.input<typeof createItemSchema>;

/**
 * Deliberately NOT `createItemSchema.partial()` — see validation/screens.ts's
 * `updateScreenSchema` block comment for the full Zod v4 `.partial()` +
 * `.default(...)` silent-reset bug writeup. Every field here is spelled out
 * as plain `.optional()` (no `.default(...)`) so an absent key means "leave
 * unchanged," not "reset to the create-time default."
 */
export const updateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  priceCents: nullableCentsSchema.optional(),
  pricingType: z.enum(pricingTypeEnum).optional(),
  categoryId: uuidSchema.optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  imageId: uuidSchema.nullable().optional(),
  aliases: z.array(z.string().min(1).max(200)).optional(),
  attributes: itemAttributesSchema.optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const setItemAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});
export type SetItemAvailabilityInput = z.infer<typeof setItemAvailabilitySchema>;

export const setItemTagsSchema = z.object({
  tagIds: z.array(uuidSchema),
});
export type SetItemTagsInput = z.infer<typeof setItemTagsSchema>;

export const setFeaturedSlotSchema = z.object({
  featuredSlotKey: featuredSlotKeySchema,
});
export type SetFeaturedSlotInput = z.infer<typeof setFeaturedSlotSchema>;

export const createItemPriceVariantSchema = z.object({
  itemId: uuidSchema,
  label: z.string().min(1).max(100),
  priceCents: nullableCentsSchema.refine((v) => v !== null, "priceCents is required for a variant"),
  sortOrder: z.number().int().default(0),
  kind: z.enum(priceVariantKindEnum).default("size"),
});
export type CreateItemPriceVariantInput = z.input<typeof createItemPriceVariantSchema>;

/**
 * Deliberately NOT `createItemPriceVariantSchema.omit({ itemId: true }).partial()`
 * — see validation/screens.ts's `updateScreenSchema` block comment for why
 * `.partial()` doesn't neutralize a `.default(...)` field. `sortOrder`/`kind`
 * are spelled out as plain `.optional()` here instead.
 */
export const updateItemPriceVariantSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  priceCents: nullableCentsSchema.refine((v) => v !== null, "priceCents is required for a variant").optional(),
  sortOrder: z.number().int().optional(),
  kind: z.enum(priceVariantKindEnum).optional(),
});
export type UpdateItemPriceVariantInput = z.infer<typeof updateItemPriceVariantSchema>;
