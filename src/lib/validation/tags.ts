// Zod schemas for src/lib/service/tags.ts.
import { z } from "zod";
import { tagVisibilityEnum } from "@/db/schema";

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  visibility: z.enum(tagVisibilityEnum).default("private"),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
});
export type CreateTagInput = z.input<typeof createTagSchema>;

/**
 * Deliberately NOT `createTagSchema.partial()` — see validation/screens.ts's
 * `updateScreenSchema` block comment for why `.partial()` doesn't neutralize
 * a `.default(...)` field. `visibility` is spelled out as plain
 * `.optional()` here instead.
 */
export const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  visibility: z.enum(tagVisibilityEnum).optional(),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
});
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
