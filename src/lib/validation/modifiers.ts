// Zod schemas for src/lib/service/modifiers.ts (addendum §1).
import { z } from "zod";
import { modifierSelectionTypeEnum } from "@/db/schema";
import { uuidSchema } from "./base";

export const createModifierGroupSchema = z.object({
  name: z.string().min(1).max(200),
  selectionType: z.enum(modifierSelectionTypeEnum),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).nullable().optional(),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type CreateModifierGroupInput = z.input<typeof createModifierGroupSchema>;

/**
 * Deliberately NOT `createModifierGroupSchema.partial()` — see validation/
 * screens.ts's `updateScreenSchema` block comment for why `.partial()`
 * doesn't neutralize a `.default(...)` field. `minSelect`/`isRequired`/
 * `sortOrder` are spelled out as plain `.optional()` here instead.
 */
export const updateModifierGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  selectionType: z.enum(modifierSelectionTypeEnum).optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).nullable().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateModifierGroupInput = z.infer<typeof updateModifierGroupSchema>;

/** Creation only accepts `pricing_mode = 'included' | 'ambiguous'` directly
 * — `delta`/`replacement` must be set via `resolveModifierOptionPricing`'s
 * two explicit buttons (addendum §1's fail-safe), never as a raw field a
 * caller can set alongside an arbitrary price in one call. Options otherwise
 * unpriced (a raw price string was seen but not parsed) are created
 * `ambiguous` with `rawPriceText` preserved. */
export const createModifierOptionSchema = z.object({
  groupId: uuidSchema,
  label: z.string().min(1).max(200),
  linkedItemId: uuidSchema.nullable().optional(),
  pricingMode: z.enum(["included", "ambiguous"]).default("ambiguous"),
  rawPriceText: z.string().max(200).nullable().optional(),
  sortOrder: z.number().int().default(0),
  isAvailable: z.boolean().default(true),
});
export type CreateModifierOptionInput = z.input<typeof createModifierOptionSchema>;

/** Non-pricing edits only (label/link/sort/availability). Changing
 * `pricing_mode` back to `ambiguous`, or editing price columns directly, is
 * intentionally NOT exposed here — see `resolveModifierOptionPricing`. */
export const updateModifierOptionSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  linkedItemId: uuidSchema.nullable().optional(),
  sortOrder: z.number().int().optional(),
  isAvailable: z.boolean().optional(),
});
export type UpdateModifierOptionInput = z.infer<typeof updateModifierOptionSchema>;

/** The addendum's "two explicit admin buttons": resolves an ambiguous (or
 * already-resolved, if the owner wants to change their mind) option to
 * either "this is the new total" (replacement) or "this is added to base"
 * (delta). Exactly one of the two price fields must be provided. */
export const resolveModifierOptionPricingSchema = z
  .object({
    mode: z.enum(["delta", "replacement"]),
    priceDeltaCents: z.number().int().min(0).max(10_000_00).optional(),
    replacementPriceCents: z.number().int().min(0).max(10_000_00).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "delta" && data.priceDeltaCents === undefined) {
      ctx.addIssue({ code: "custom", message: "priceDeltaCents is required when mode='delta'" });
    }
    if (data.mode === "replacement" && data.replacementPriceCents === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "replacementPriceCents is required when mode='replacement'",
      });
    }
  });
export type ResolveModifierOptionPricingInput = z.infer<typeof resolveModifierOptionPricingSchema>;

export const createModifierGroupAttachmentSchema = z
  .object({
    groupId: uuidSchema,
    itemId: uuidSchema.nullable().optional(),
    categoryId: uuidSchema.nullable().optional(),
    sortOrder: z.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    const hasItem = data.itemId != null;
    const hasCategory = data.categoryId != null;
    if (hasItem === hasCategory) {
      ctx.addIssue({
        code: "custom",
        message: "exactly one of itemId / categoryId must be set",
        path: ["itemId"],
      });
    }
  });
export type CreateModifierGroupAttachmentInput = z.input<typeof createModifierGroupAttachmentSchema>;

export const setItemModifierOptionExclusionsSchema = z.object({
  optionIds: z.array(uuidSchema),
});
export type SetItemModifierOptionExclusionsInput = z.infer<
  typeof setItemModifierOptionExclusionsSchema
>;
