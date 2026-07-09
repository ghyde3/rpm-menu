// Settings > Menu Behavior tab (PRD §3.8): the global default for
// unavailable-item treatment (hide vs 86-badge) on web and displays
// (per-screen setting still overrides — owned by the screens unit), public
// menu image/public-tag-badge visibility toggles, and SEO title/description.
// All stored under `venue_settings.menu_behavior` jsonb. Settings is
// "owner-only" per §3.8's section header, so every mutation requires the
// owner role.
//
// The `qr/` sub-route under this tab's admin path (§3.8's QR code
// generator) is reserved for the M3 settings-api-keys-data-recovery-
// sessions-qr unit — nothing in this file reaches into QR generation.
//
// Zod validation lives inline in this file (mirrors settings/venue.ts) —
// no shared src/lib/validation/settings.ts exists and this unit's
// owns_paths don't include the validation directory.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { venueSettings, VENUE_SETTINGS_ID, type MenuBehaviorConfig } from "@/db/schema";
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
import { UNAVAILABLE_TREATMENTS, type UnavailableTreatment } from "./menu-behavior-constants";

export type VenueSettingsRow = typeof venueSettings.$inferSelect;

// --- Validation -----------------------------------------------------------
//
// Re-exported from ./menu-behavior-constants (a module with zero dependency
// on src/lib/service/base/**, which transitively pulls in next/cache's
// revalidatePath) so server-side callers can keep importing these from this
// file, while the "use client" MenuBehaviorSettingsForm.tsx imports the
// constants module directly and never bundles this server-only file.
export { UNAVAILABLE_TREATMENTS, type UnavailableTreatment };

export const updateMenuBehaviorSchema = z.object({
  unavailableTreatment: z.enum(UNAVAILABLE_TREATMENTS).optional(),
  showImages: z.boolean().optional(),
  showPublicTagBadges: z.boolean().optional(),
  seoTitle: z.string().max(70).nullable().optional(),
  seoDescription: z.string().max(200).nullable().optional(),
});
export type UpdateMenuBehaviorInput = z.input<typeof updateMenuBehaviorSchema>;

/** Defaults applied when a field has never been set — the DB column itself
 * defaults to `{}` (src/db/schema/settings.ts) so every read resolves
 * through here rather than leaving `undefined` for every caller to
 * special-case. */
const MENU_BEHAVIOR_DEFAULTS = {
  unavailableTreatment: "badge" as UnavailableTreatment,
  showImages: true,
  showPublicTagBadges: true,
};

export interface ResolvedMenuBehavior {
  unavailableTreatment: UnavailableTreatment;
  showImages: boolean;
  showPublicTagBadges: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

function resolveMenuBehavior(config: MenuBehaviorConfig | null | undefined): ResolvedMenuBehavior {
  return {
    unavailableTreatment: config?.unavailableTreatment ?? MENU_BEHAVIOR_DEFAULTS.unavailableTreatment,
    showImages: config?.showImages ?? MENU_BEHAVIOR_DEFAULTS.showImages,
    showPublicTagBadges: config?.showPublicTagBadges ?? MENU_BEHAVIOR_DEFAULTS.showPublicTagBadges,
    seoTitle: config?.seoTitle ?? null,
    seoDescription: config?.seoDescription ?? null,
  };
}

// --- Reads ------------------------------------------------------------------

/** Mirrors settings/venue.ts's identically-named helper (each settings tab
 * file is self-contained per plan conventions). */
async function getOrCreateVenueSettingsRow(db: DbClient): Promise<VenueSettingsRow> {
  const [existing] = await db.select().from(venueSettings).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
  if (existing) return existing;
  const [created] = await db.insert(venueSettings).values({ id: VENUE_SETTINGS_ID }).returning();
  return created;
}

export async function getMenuBehaviorSettings(db: DbClient): Promise<ResolvedMenuBehavior> {
  const row = await getOrCreateVenueSettingsRow(db);
  return resolveMenuBehavior(row.menuBehavior);
}

// --- Writes -------------------------------------------------------------

export async function updateMenuBehavior(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: UpdateMenuBehaviorInput,
): Promise<ResolvedMenuBehavior> {
  requireOwnerCaller(caller);
  const input = updateMenuBehaviorSchema.parse(rawInput);
  const before = await getOrCreateVenueSettingsRow(db);

  const nextConfig: MenuBehaviorConfig = { ...before.menuBehavior };
  if (input.unavailableTreatment !== undefined) nextConfig.unavailableTreatment = input.unavailableTreatment;
  if (input.showImages !== undefined) nextConfig.showImages = input.showImages;
  if (input.showPublicTagBadges !== undefined) nextConfig.showPublicTagBadges = input.showPublicTagBadges;
  if (input.seoTitle !== undefined) nextConfig.seoTitle = input.seoTitle ?? undefined;
  if (input.seoDescription !== undefined) nextConfig.seoDescription = input.seoDescription ?? undefined;

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_menu_behavior_settings",
      entityType: "setting",
      entityId: VENUE_SETTINGS_ID,
      before,
    },
    async () => {
      const [after] = await db
        .update(venueSettings)
        .set({ menuBehavior: nextConfig, updatedAt: new Date() })
        .where(eq(venueSettings.id, VENUE_SETTINGS_ID))
        .returning();
      return { result: after, after };
    },
  );

  // The global default treatment/visibility affects every item/screen's
  // public rendering rather than a specific item/category/tag/screen scope
  // — bump nothing-scoped just to revalidate `/menu` (mirrors
  // settings/venue.ts's rationale for venue-wide fields).
  await bumpAffectedScreens(db, {});
  return resolveMenuBehavior(updated.menuBehavior);
}

// --- Revert registration ----------------------------------------------
//
// Shared `entity_type = "setting"` covers every Settings tab that mutates
// the same `venue_settings` singleton row. Whichever tab's module happens
// to import first "wins" this registration, but the implementation is
// generic full-row restore keyed off the fixed singleton id, so it's
// correct regardless of which tab produced the audit entry (see
// settings/venue.ts's identical registration + docs/architecture.md wave
// notes).
registerRevertHandler("setting", async (db, ctx) => {
  if (ctx.before === null || ctx.before === undefined) {
    throw new ConflictError("setting revert requires a captured `before` snapshot");
  }
  const beforeRow = reviveDates(ctx.before as VenueSettingsRow, ["updatedAt"]);
  await db.update(venueSettings).set(beforeRow).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
});
