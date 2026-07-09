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

export const updateTagSchema = createTagSchema.partial();
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
