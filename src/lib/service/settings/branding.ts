// Settings > Branding tab (PRD §3.8): logo upload (uses the §3.1a image
// pipeline, wired through `POST /api/upload` — see src/lib/service/images.ts),
// a brand color palette (primary/accent), and a curated font choice (3-5
// licensed/Google fonts — "not a font picker free-for-all"). These set the
// *defaults* consumed by the public menu and screen templates; per §3.2
// individual screens can still override accent color.
//
// Zod validation lives inline in this file (mirrors settings/venue.ts) —
// no shared src/lib/validation/settings.ts exists and this unit's
// owns_paths don't include the validation directory.
//
// Font scope decision: the design system (`RPM Pub Design System/tokens/
// fonts.css`) loads exactly four webfonts globally (Anton, Oswald, Zilla
// Slab, Bungee) via one `@import`. Rather than introducing a fifth+ font
// family (extra network fetch, off-system look), the curated set below
// reuses those four already-loaded families as the public-menu/screen
// default — satisfying §3.8's "3-5 licensed/Google fonts" instruction
// without adding new font loads. Consuming surfaces (public menu, screen
// templates) resolve a stored `font` value to a CSS stack via
// `BRANDING_FONT_STACKS`.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { venueSettings, VENUE_SETTINGS_ID, type BrandingConfig } from "@/db/schema";
import { uuidSchema } from "@/lib/validation/base";
import {
  requireOwnerCaller,
  withAudit,
  bumpAffectedScreens,
  registerRevertHandler,
  reviveDates,
  type DbClient,
  type ServiceCaller,
} from "../base";
import { ConflictError } from "../base/errors";
import {
  BRANDING_FONT_OPTIONS,
  BRANDING_FONT_STACKS,
  BRANDING_COLOR_SWATCHES,
  BRANDING_FONT_VALUES,
  type BrandingFont,
} from "./branding-constants";

export type VenueSettingsRow = typeof venueSettings.$inferSelect;

// --- Curated options ------------------------------------------------------
//
// Re-exported from ./branding-constants (a module with zero dependency on
// src/lib/service/base/**, which transitively pulls in next/cache's
// revalidatePath) so server-side callers can keep importing these from this
// file, while the "use client" BrandingSettingsForm.tsx imports the
// constants module directly and never bundles this server-only file.
export { BRANDING_FONT_OPTIONS, BRANDING_FONT_STACKS, BRANDING_COLOR_SWATCHES, type BrandingFont };

// --- Validation -----------------------------------------------------------

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color, e.g. "#d63a2c"');

const brandingFontSchema = z.enum(BRANDING_FONT_VALUES);

export const updateBrandingSchema = z.object({
  // Foreign key into `images` (image-pipeline unit). Cleared with `null`.
  logoImageId: uuidSchema.nullable().optional(),
  primaryColor: hexColorSchema.nullable().optional(),
  accentColor: hexColorSchema.nullable().optional(),
  font: brandingFontSchema.nullable().optional(),
});
export type UpdateBrandingInput = z.input<typeof updateBrandingSchema>;

export interface BrandingSettings {
  logoImageId: string | null;
  branding: BrandingConfig;
}

// --- Reads ------------------------------------------------------------------

/** `venue_settings` is a singleton seeded by `npm run db:seed`, but test dbs
 * (and a from-scratch install run out of order) may not have the row yet —
 * auto-create it with schema defaults rather than making every caller
 * special-case "not found" for a table that only ever has one row. Mirrors
 * settings/venue.ts's identically-named helper (each settings tab file is
 * self-contained per plan conventions). */
async function getOrCreateVenueSettingsRow(db: DbClient): Promise<VenueSettingsRow> {
  const [existing] = await db.select().from(venueSettings).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
  if (existing) return existing;
  const [created] = await db.insert(venueSettings).values({ id: VENUE_SETTINGS_ID }).returning();
  return created;
}

export async function getBrandingSettings(db: DbClient): Promise<BrandingSettings> {
  const row = await getOrCreateVenueSettingsRow(db);
  return { logoImageId: row.logoImageId, branding: row.branding ?? {} };
}

// --- Writes -------------------------------------------------------------

export async function updateBranding(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: UpdateBrandingInput,
): Promise<BrandingSettings> {
  requireOwnerCaller(caller);
  const input = updateBrandingSchema.parse(rawInput);
  const before = await getOrCreateVenueSettingsRow(db);

  const nextBranding: BrandingConfig = { ...before.branding };
  if (input.primaryColor !== undefined) nextBranding.primaryColor = input.primaryColor ?? undefined;
  if (input.accentColor !== undefined) nextBranding.accentColor = input.accentColor ?? undefined;
  if (input.font !== undefined) nextBranding.font = input.font ?? undefined;

  const setValues: Partial<typeof venueSettings.$inferInsert> = {
    branding: nextBranding,
    updatedAt: new Date(),
  };
  if (input.logoImageId !== undefined) setValues.logoImageId = input.logoImageId;

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_branding_settings",
      entityType: "setting",
      entityId: VENUE_SETTINGS_ID,
      before,
    },
    async () => {
      const [after] = await db
        .update(venueSettings)
        .set(setValues)
        .where(eq(venueSettings.id, VENUE_SETTINGS_ID))
        .returning();
      return { result: after, after };
    },
  );

  // Branding is a venue-wide default (not scoped to any item/category/tag),
  // but the public menu + screen templates still need `/menu` revalidated
  // to pick up the new logo/colors/font on next render.
  await bumpAffectedScreens(db, {});
  return { logoImageId: updated.logoImageId, branding: updated.branding };
}

// --- Revert registration ----------------------------------------------
//
// Shared `entity_type = "setting"` covers every Settings tab that mutates
// the same `venue_settings` singleton row (Venue, Branding, Menu Behavior).
// Whichever tab's module happens to import first "wins" this registration,
// but the implementation is generic full-row restore keyed off the fixed
// singleton id, so it's correct regardless of which tab produced the audit
// entry (see settings/venue.ts's identical registration + docs/architecture.md
// wave notes).
registerRevertHandler("setting", async (db, ctx) => {
  if (ctx.before === null || ctx.before === undefined) {
    throw new ConflictError("setting revert requires a captured `before` snapshot");
  }
  const beforeRow = reviveDates(ctx.before as VenueSettingsRow, ["updatedAt"]);
  await db.update(venueSettings).set(beforeRow).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
});
