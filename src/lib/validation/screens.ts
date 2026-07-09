// Zod schemas for src/lib/service/screens.ts (PRD §3.2 + addendum §2's
// `price_mode = 'happy_hour'` flag). Single validation source of truth for
// screen mutations across admin UI / (future) REST/MCP surfaces.
import { z } from "zod";
import { screenTemplateEnum, screenSourceModeEnum } from "@/db/schema";
import { uuidSchema } from "./base";

/** `source_config` for query mode (PRD §5.1 notes: "query mode:
 * `{tag_ids?, category_ids?, order_by}`"). Kept permissive on unknown keys —
 * mirrors `categoryDisplayConfigSchema`'s stance in validation/categories.ts —
 * but the known keys are typed and checked. */
export const screenSourceConfigSchema = z
  .object({
    tagIds: z.array(uuidSchema).optional(),
    categoryIds: z.array(uuidSchema).optional(),
    orderBy: z.enum(["sort_order", "name", "price"]).optional(),
  })
  .catchall(z.unknown());
export type ScreenSourceConfigInput = z.infer<typeof screenSourceConfigSchema>;

/** `display_options` (§3.2: "title, accent color, font scale, columns, and
 * per-surface toggles ... for density control", plus the overflow-pagination
 * interval and addendum §2's happy-hour price flag).
 *
 * All fields are `.optional()` rather than `.default(...)` — every consumer
 * (src/lib/screens/resolve.ts, ScreenRenderer) already applies its own
 * fallback via `?? <default>` at the point of use, the same "unset means
 * inherit/default" convention `display-line.ts` uses for category display
 * config. Keeping schema-level defaults out of this object also sidesteps a
 * Zod v4 typing quirk where a `.default(...)` field nested under
 * `.catchall()` makes the *outer* `createScreenSchema`'s own
 * `displayOptions: screenDisplayOptionsSchema.default({})` fail to
 * typecheck (the inferred "input" shape stops treating the defaulted field
 * as optional). */
export const screenDisplayOptionsSchema = z
  .object({
    title: z.string().max(200).optional(),
    accentColor: z.string().max(50).optional(),
    /** Manual density knob — distinct from the automatic overflow font-scale
     * floor (src/lib/screens/overflow.ts). 0.5–1.5 keeps it sane. */
    fontScale: z.number().min(0.5).max(1.5).optional(),
    columns: z.number().int().min(1).max(4).optional(),
    showDescriptions: z.boolean().optional(),
    showBadges: z.boolean().optional(),
    showAttributes: z.boolean().optional(),
    /** Default `"hide"` applied by src/lib/screens/resolve.ts, not here. */
    unavailableTreatment: z.enum(["hide", "badge"]).optional(),
    /** Overflow-pagination rotation interval, seconds. Default (12s, §3.2)
     * applied by ScreenRenderer via `DEFAULT_PAGINATION_INTERVAL_SECONDS`. */
    paginationIntervalSeconds: z.number().int().min(3).max(120).optional(),
    /** Default `"standard"` applied by src/lib/screens/resolve.ts, not here. */
    priceMode: z.enum(["standard", "happy_hour"]).optional(),
  })
  .catchall(z.unknown());
export type ScreenDisplayOptionsInput = z.infer<typeof screenDisplayOptionsSchema>;

export const createScreenSchema = z.object({
  name: z.string().min(1).max(200),
  template: z.enum(screenTemplateEnum).default("list"),
  sourceMode: z.enum(screenSourceModeEnum).default("query"),
  sourceConfig: screenSourceConfigSchema.default({}),
  displayOptions: screenDisplayOptionsSchema.default({}),
  backgroundImageKey: z.string().max(500).nullable().optional(),
});
export type CreateScreenInput = z.input<typeof createScreenSchema>;

/**
 * Deliberately NOT `createScreenSchema.partial()`. Verified empirically
 * (Zod v4.4.3): `.partial()` wraps each field in `.optional()`, but a field
 * that ALSO carries `.default(...)` still has its default applied when the
 * key is absent from the input object — `.optional()` does not short-circuit
 * ahead of a nested `ZodDefault`. Concretely:
 *
 * ```ts
 * z.object({ a: z.string(), b: z.enum(["x","y"]).default("x") })
 *   .partial()
 *   .parse({ a: "hi" }) // => { a: "hi", b: "x" } — NOT `{ a: "hi" }`
 * ```
 *
 * For an *update* schema that would mean calling `updateScreen(db, caller,
 * id, { name: "New Name" })` silently resets `template`/`sourceMode` to
 * "list"/"query" and `sourceConfig`/`displayOptions` to `{}` on every save
 * that doesn't explicitly re-send them — exactly the kind of silent-reset
 * bug the addendum's disambiguation rules exist to prevent elsewhere. Every
 * field here is spelled out as plain `.optional()` (no `.default(...)`)
 * instead, so an absent key truly means "leave unchanged."
 */
export const updateScreenSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  template: z.enum(screenTemplateEnum).optional(),
  sourceMode: z.enum(screenSourceModeEnum).optional(),
  sourceConfig: screenSourceConfigSchema.optional(),
  displayOptions: screenDisplayOptionsSchema.optional(),
  backgroundImageKey: z.string().max(500).nullable().optional(),
});
export type UpdateScreenInput = z.infer<typeof updateScreenSchema>;

/** Manual-mode explicit ordered item list (§3.2) — full-replace, order given
 * by array index, mirroring `setItemTagsSchema`'s full-replace convention in
 * validation/items.ts. */
export const setScreenItemsSchema = z.object({
  itemIds: z.array(uuidSchema),
});
export type SetScreenItemsInput = z.infer<typeof setScreenItemsSchema>;
