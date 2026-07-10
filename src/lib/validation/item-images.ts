// Zod schemas for src/lib/service/item-images.ts. Single validation source
// of truth for item-gallery mutations across admin UI / REST / MCP (§3.6).
import { z } from "zod";
import { uuidSchema } from "./base";

export const addItemImageSchema = z.object({
  imageId: uuidSchema,
});
export type AddItemImageInput = z.infer<typeof addItemImageSchema>;

/** Full-replace ordering — every existing gallery row's id must appear
 * exactly once. Service layer (not this schema) validates set-equality
 * against the item's current gallery, since that requires a DB read. */
export const reorderItemImagesSchema = z.object({
  orderedItemImageIds: z.array(uuidSchema).min(1),
});
export type ReorderItemImagesInput = z.infer<typeof reorderItemImagesSchema>;

export const setPrimaryItemImageSchema = z.object({
  itemImageId: uuidSchema,
});
export type SetPrimaryItemImageInput = z.infer<typeof setPrimaryItemImageSchema>;

export const removeItemImageSchema = z.object({
  itemImageId: uuidSchema,
});
export type RemoveItemImageInput = z.infer<typeof removeItemImageSchema>;
