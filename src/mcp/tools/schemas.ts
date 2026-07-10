// Zod raw-shape input schemas for every MCP tool (§3.7: "All inputs
// Zod-validated"). These are intentionally a thin outer shape only --
// `McpServer.registerTool` validates them before a handler ever runs, but
// the *real*, single-source-of-truth validation for what actually reaches
// the DB still happens inside the service functions themselves
// (`updateItemSchema`, `setItemAvailabilitySchema`, `bulkPriceAdjustInputSchema`,
// `updateScreenSchema`, ...) -- exactly like the REST route handlers in
// src/app/api/v1/**, which pass loosely-typed bodies straight through to the
// same service calls and let them do the strict parse. Reusing enums/nested
// schemas from src/lib/validation/** and src/db/schema keeps the two shapes
// from drifting.
import { z } from "zod";
import { pricingTypeEnum, screenTemplateEnum, screenSourceModeEnum, ENTITY_TYPES } from "@/db/schema";
import { itemAttributesSchema } from "@/lib/validation/items";
import { screenSourceConfigSchema, screenDisplayOptionsSchema } from "@/lib/validation/screens";

const uuid = () => z.uuid();

export const searchItemsShape = {
  q: z.string().max(200).optional(),
  categoryId: uuid().optional(),
  tagId: uuid().optional(),
  isAvailable: z.boolean().optional(),
  pricingType: z.enum(pricingTypeEnum).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
};

export const setAvailabilityShape = {
  itemId: uuid(),
  isAvailable: z.boolean(),
};

export const updateItemShape = {
  itemId: uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  priceCents: z.number().int().min(0).max(10_000_00).nullable().optional(),
  pricingType: z.enum(pricingTypeEnum).optional(),
  categoryId: uuid().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  imageId: uuid().nullable().optional(),
  aliases: z.array(z.string().min(1).max(200)).optional(),
  attributes: itemAttributesSchema.optional(),
};

/** No `isAvailable` filter here on purpose -- the tool's whole point is
 * "show me the 86'd items", so it's hardcoded server-side, not client-
 * suppliable (which would let a caller silently repurpose it into a generic
 * second `search_items`). */
export const list86dShape = {
  q: z.string().max(200).optional(),
  categoryId: uuid().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
};

export const previewPriceAdjustmentShape = {
  itemIds: z.array(uuid()).min(1, "select at least one item").max(200, "bulk ops are capped at 200 items per call"),
  mode: z.enum(["flat", "percent"]),
  amountCents: z.number().int().optional(),
  percent: z.number().optional(),
};

export const applyPendingChangeShape = {
  pendingChangeId: uuid(),
};

export const getScreenShape = {
  screenId: uuid(),
};

export const updateScreenShape = {
  screenId: uuid(),
  name: z.string().min(1).max(200).optional(),
  template: z.enum(screenTemplateEnum).optional(),
  sourceMode: z.enum(screenSourceModeEnum).optional(),
  sourceConfig: screenSourceConfigSchema.optional(),
  displayOptions: screenDisplayOptionsSchema.optional(),
  backgroundImageKey: z.string().max(500).nullable().optional(),
};

export const getRecentChangesShape = {
  actorId: uuid().optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
};

// `McpServer.registerTool` wants the bare raw shapes above (a plain object
// of top-level field schemas); handler functions want a plain parsed-args
// type. Wrapping each shape in `z.object(...)` once here gives both without
// duplicating the field list -- `z.infer` off the object schema, `.shape`
// (== the original raw shape) for registration.
export const searchItemsSchema = z.object(searchItemsShape);
export const setAvailabilitySchema = z.object(setAvailabilityShape);
export const updateItemSchema = z.object(updateItemShape);
export const list86dSchema = z.object(list86dShape);
export const previewPriceAdjustmentSchema = z.object(previewPriceAdjustmentShape);
export const applyPendingChangeSchema = z.object(applyPendingChangeShape);
export const getScreenSchema = z.object(getScreenShape);
export const updateScreenSchema = z.object(updateScreenShape);
export const getRecentChangesSchema = z.object(getRecentChangesShape);

export type SearchItemsArgs = z.infer<typeof searchItemsSchema>;
export type SetAvailabilityArgs = z.infer<typeof setAvailabilitySchema>;
export type UpdateItemArgs = z.infer<typeof updateItemSchema>;
export type List86dArgs = z.infer<typeof list86dSchema>;
export type PreviewPriceAdjustmentArgs = z.infer<typeof previewPriceAdjustmentSchema>;
export type ApplyPendingChangeArgs = z.infer<typeof applyPendingChangeSchema>;
export type GetScreenArgs = z.infer<typeof getScreenSchema>;
export type UpdateScreenArgs = z.infer<typeof updateScreenSchema>;
export type GetRecentChangesArgs = z.infer<typeof getRecentChangesSchema>;
