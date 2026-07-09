// Settings > Venue tab (PRD §3.8 + addendum context): the `venue_settings`
// singleton row's name/logo/address/phone/social/hours, timezone (which
// drives display schedules per §3.2a — changing it must show a
// change-impact warning), and currency/price-format toggles. Settings is
// "owner-only" per §3.8's section header, so every mutation (and every read
// exposed through this module) requires the owner role.
//
// Zod validation lives inline in this file rather than a shared
// src/lib/validation/settings.ts — this unit's owns_paths don't include the
// validation directory, and no other unit needs these schemas.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { displaySchedules, venueSettings, VENUE_SETTINGS_ID } from "@/db/schema";
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

export type VenueSettingsRow = typeof venueSettings.$inferSelect;

// --- Validation -----------------------------------------------------------

const VENUE_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const dayHoursSchema = z.object({
  open: z.string().max(16).optional(),
  close: z.string().max(16).optional(),
  closed: z.boolean().optional(),
});

const venueHoursSchema = z
  .object(
    Object.fromEntries(VENUE_DAYS.map((day) => [day, dayHoursSchema.optional()])) as Record<
      (typeof VENUE_DAYS)[number],
      z.ZodOptional<typeof dayHoursSchema>
    >,
  )
  .catchall(dayHoursSchema.optional());

const venueSocialSchema = z
  .object({
    website: z.string().max(500).optional(),
    instagram: z.string().max(200).optional(),
    facebook: z.string().max(200).optional(),
    twitter: z.string().max(200).optional(),
  })
  .catchall(z.string().optional());

const currencyFormatSchema = z.object({
  symbol: z.string().min(1).max(4).optional(),
  showTrailingZeros: z
    .object({ web: z.boolean().optional(), display: z.boolean().optional() })
    .optional(),
});

/** Rejects anything `Intl` can't resolve as an IANA zone identifier —
 * cheaper and more complete than hand-maintaining a zone allowlist, and
 * catches typos before they reach `display_schedules` evaluation. */
const timezoneSchema = z.string().min(1).max(100).refine((tz) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Not a recognized IANA timezone (e.g. \"America/Chicago\")");

export const updateVenueSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  // Foreign key into `images` (owned by the image-pipeline unit). No upload
  // UI ships from this unit yet — see the Venue page's header comment for
  // the documented gap — so this accepts an already-created image's id.
  logoImageId: uuidSchema.nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  social: venueSocialSchema.optional(),
  hours: venueHoursSchema.optional(),
  timezone: timezoneSchema.optional(),
  currencyFormat: currencyFormatSchema.optional(),
});
export type UpdateVenueSettingsInput = z.input<typeof updateVenueSettingsSchema>;

// --- Reads ------------------------------------------------------------------

/** `venue_settings` is a singleton seeded by `npm run db:seed`, but test dbs
 * (and a from-scratch install run out of order) may not have the row yet —
 * auto-create it with schema defaults rather than making every caller
 * special-case "not found" for a table that only ever has one row. */
async function getOrCreateVenueSettingsRow(db: DbClient): Promise<VenueSettingsRow> {
  const [existing] = await db.select().from(venueSettings).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
  if (existing) return existing;
  const [created] = await db.insert(venueSettings).values({ id: VENUE_SETTINGS_ID }).returning();
  return created;
}

export async function getVenueSettings(db: DbClient): Promise<VenueSettingsRow> {
  return getOrCreateVenueSettingsRow(db);
}

export interface TimezoneChangeImpact {
  currentTimezone: string;
  newTimezone: string;
  changed: boolean;
  /** Every `display_schedules` row (owned by the displays/schedule unit) —
   * a timezone shift re-anchors every weekly rule's wall-clock evaluation,
   * not a targeted subset, so the impact count is simply "all of them". */
  affectedScheduleCount: number;
  affectedDisplayCount: number;
}

/**
 * Read-only preview backing §3.8's "changing [timezone] shows a warning
 * about schedule impact." Admin UI calls this before `updateVenueSettings`
 * whenever the submitted timezone differs from the current one, and shows
 * the counts as a confirm-to-proceed warning.
 */
export async function previewTimezoneChange(
  db: DbClient,
  newTimezone: string,
): Promise<TimezoneChangeImpact> {
  const current = await getOrCreateVenueSettingsRow(db);
  const scheduleRows = await db.select({ displayId: displaySchedules.displayId }).from(displaySchedules);
  const affectedDisplayCount = new Set(scheduleRows.map((row) => row.displayId)).size;
  return {
    currentTimezone: current.timezone,
    newTimezone,
    changed: current.timezone !== newTimezone,
    affectedScheduleCount: scheduleRows.length,
    affectedDisplayCount,
  };
}

// --- Writes -------------------------------------------------------------

export async function updateVenueSettings(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: UpdateVenueSettingsInput,
): Promise<VenueSettingsRow> {
  requireOwnerCaller(caller);
  const input = updateVenueSettingsSchema.parse(rawInput);
  const before = await getOrCreateVenueSettingsRow(db);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_venue_settings",
      entityType: "setting",
      entityId: VENUE_SETTINGS_ID,
      before,
    },
    async () => {
      const [after] = await db
        .update(venueSettings)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(venueSettings.id, VENUE_SETTINGS_ID))
        .returning();
      return { result: after, after };
    },
  );

  // Venue-wide fields (currency formatting, timezone, contact info) aren't
  // scoped to any item/category/tag/screen, so there's nothing to target in
  // bumpAffectedScreens' scope — but the public menu still needs `/menu`
  // revalidated so it picks up new formatting/contact info on next render.
  await bumpAffectedScreens(db, {});
  return updated;
}

// --- Revert registration ----------------------------------------------
//
// Shared `entity_type = "setting"` covers every Settings tab that mutates
// the same `venue_settings` singleton row (Venue here; Branding/Menu
// Behavior are separate units). Whichever tab's module happens to import
// first "wins" this registration, but the implementation is generic
// full-row restore keyed off the fixed singleton id, so it's correct
// regardless of which tab produced the audit entry.
registerRevertHandler("setting", async (db, ctx) => {
  if (ctx.before === null || ctx.before === undefined) {
    // venue_settings is a singleton that always exists once seeded — no
    // "setting" audit row should ever have a null `before` (that would mean
    // a create, which this table never does after first seed).
    throw new ConflictError("setting revert requires a captured `before` snapshot");
  }
  const beforeRow = reviveDates(ctx.before as VenueSettingsRow, ["updatedAt"]);
  await db.update(venueSettings).set(beforeRow).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
});
