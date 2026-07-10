// Zod schemas for src/lib/service/categories.ts.
import { z } from "zod";
import { categoryTypeEnum } from "@/db/schema";
import { uuidSchema } from "./base";

/** `display_config` shape (§3.1 Item Display Schema): attribute order + per
 * surface show/hide toggles. Kept permissive on unknown keys (`display_config`
 * is a per-category rendering-knobs bag, not a validated attribute registry
 * like `items.attributes`) but the known keys are typed and checked. */
const itemAttributeKeySchema = z.enum(["abv", "ibu", "flavor_profile", "origin", "calories", "style"]);

export const categoryDisplayConfigSchema = z
  .object({
    attributeOrder: z.array(itemAttributeKeySchema).optional(),
    showDescription: z.object({ web: z.boolean().optional(), display: z.boolean().optional() }).optional(),
    showBadges: z.boolean().optional(),
  })
  .catchall(z.unknown());

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(categoryTypeEnum),
  sortOrder: z.number().int().default(0),
  displayConfig: categoryDisplayConfigSchema.default({}),
  tagline: z.string().max(200).nullable().optional(),
  imageId: uuidSchema.nullable().optional(),
});
export type CreateCategoryInput = z.input<typeof createCategorySchema>;

/**
 * Deliberately NOT `createCategorySchema.partial()` — see validation/
 * screens.ts's `updateScreenSchema` block comment for why `.partial()`
 * doesn't neutralize a `.default(...)` field. `sortOrder`/`displayConfig`
 * are spelled out as plain `.optional()` here instead.
 */
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(categoryTypeEnum).optional(),
  sortOrder: z.number().int().optional(),
  displayConfig: categoryDisplayConfigSchema.optional(),
  tagline: z.string().max(200).nullable().optional(),
  imageId: uuidSchema.nullable().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
