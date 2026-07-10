// Settings > Data & Recovery tab (§3.8): backup status display, one-click
// full JSON export (menu, screens, settings), and a cross-link to Recent
// Changes/revert (the feature itself lives in the audit/revert unit's admin
// route -- this module only surfaces the link target, per §3.8: "the
// feature lives in main nav; settings just cross-links"). Owner-only, same
// posture as every other Settings tab.
//
// Backup status (documented gap, not a silent shortcut): PRD §3.6 commits
// to "daily automated Postgres backups" and §3.8 says the timestamp is
// "read from provider or heartbeat job" -- no such job/table exists yet in
// this schema or codebase (grepped; nothing under src/db/schema/** or
// scripts/** writes a backup heartbeat), and this unit's owns_paths don't
// include the schema or a scripts/ backup runner. Rather than fabricate a
// fake "last backup" timestamp, `getBackupStatus` reports whatever a real
// backup job would leave behind (an env var a cron/host-level backup
// script is expected to set) and returns an explicit "not configured"
// state otherwise, so the UI is honest about the gap instead of masking
// it. Wiring an actual backup job is flagged as follow-up work outside
// this unit's scope.
import { desc, eq } from "drizzle-orm";
import {
  categories,
  tags,
  items,
  itemTags,
  itemPriceVariants,
  modifierGroups,
  modifierOptions,
  modifierGroupAttachments,
  itemModifierOptionExclusions,
  screens,
  screenItems,
  displays,
  displaySchedules,
  venueSettings,
  VENUE_SETTINGS_ID,
} from "@/db/schema";
import { requireOwnerCaller, type DbClient, type ServiceCaller } from "../base";

// --- Backup status ---------------------------------------------------------

export interface BackupStatus {
  /** Timestamp of the last successful backup, or `null` if unknown/never
   * configured. */
  lastSuccessfulBackupAt: Date | null;
  /** Where the timestamp came from -- lets the UI distinguish "backups are
   * running, here's when" from "no backup signal has ever been wired up". */
  source: "env" | "not_configured";
}

const BACKUP_TIMESTAMP_ENV_VAR = "BACKUP_LAST_SUCCESS_AT";

/** Reads whatever the venue's actual backup job (daily automated Postgres
 * backup, §3.6) last recorded. No heartbeat table exists in this schema
 * (see module doc) -- an ISO-8601 timestamp in `BACKUP_LAST_SUCCESS_AT` is
 * the cheapest real signal a cron/host backup script can produce without a
 * schema change; unset/unparseable reports `not_configured` rather than a
 * fabricated date. */
export async function getBackupStatus(_db: DbClient, caller: ServiceCaller): Promise<BackupStatus> {
  requireOwnerCaller(caller);
  const raw = process.env[BACKUP_TIMESTAMP_ENV_VAR];
  if (!raw) return { lastSuccessfulBackupAt: null, source: "not_configured" };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { lastSuccessfulBackupAt: null, source: "not_configured" };
  return { lastSuccessfulBackupAt: parsed, source: "env" };
}

// --- Full export ------------------------------------------------------------

/** Shape of the one-click full export (§3.8: "JSON dump of menu, screens,
 * settings"). Deliberately scoped to exactly those three per the PRD's own
 * wording -- no `users`/`accounts`/`sessions`/`api_keys` rows (those carry
 * credentials/secrets and are the Users/API Keys tabs' own concern, not a
 * "client owns their menu data" migration export), and `displays` rows omit
 * `tokenHash` for the same reason (see `ExportedDisplay`). */
export interface ExportedDisplay {
  id: string;
  name: string;
  screenId: string | null;
  pairedAt: Date | null;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface FullDataExport {
  exportedAt: string;
  version: 1;
  menu: {
    categories: (typeof categories.$inferSelect)[];
    tags: (typeof tags.$inferSelect)[];
    items: (typeof items.$inferSelect)[];
    itemTags: (typeof itemTags.$inferSelect)[];
    itemPriceVariants: (typeof itemPriceVariants.$inferSelect)[];
    modifierGroups: (typeof modifierGroups.$inferSelect)[];
    modifierOptions: (typeof modifierOptions.$inferSelect)[];
    modifierGroupAttachments: (typeof modifierGroupAttachments.$inferSelect)[];
    itemModifierOptionExclusions: (typeof itemModifierOptionExclusions.$inferSelect)[];
  };
  screens: {
    screens: (typeof screens.$inferSelect)[];
    screenItems: (typeof screenItems.$inferSelect)[];
  };
  displays: {
    displays: ExportedDisplay[];
    displaySchedules: (typeof displaySchedules.$inferSelect)[];
  };
  settings: typeof venueSettings.$inferSelect;
}

/** Builds the full JSON export. Read-only -- not a mutation, so per §3.5
 * ("every mutation writes an audit row") this deliberately does NOT write
 * to `audit_log`: every registered `entity_type` in this schema (`setting`
 * included) is a specific table's row-diff format used by that table's own
 * revert handler, and there is no "data_export" entity type to add without
 * a schema change this unit isn't permitted to make. Logging it under an
 * existing entity type (e.g. "setting", which venue.ts's revert handler
 * blindly writes straight back into the `venue_settings` row) would risk a
 * future revert corrupting unrelated state -- worse than not logging a
 * read at all. */
export async function exportFullData(db: DbClient, caller: ServiceCaller): Promise<FullDataExport> {
  requireOwnerCaller(caller);

  const [
    categoryRows,
    tagRows,
    itemRows,
    itemTagRows,
    itemPriceVariantRows,
    modifierGroupRows,
    modifierOptionRows,
    modifierGroupAttachmentRows,
    itemModifierOptionExclusionRows,
    screenRows,
    screenItemRows,
    displayRows,
    displayScheduleRows,
  ] = await Promise.all([
    db.select().from(categories).orderBy(categories.sortOrder),
    db.select().from(tags).orderBy(tags.name),
    db.select().from(items).orderBy(items.sortOrder),
    db.select().from(itemTags),
    db.select().from(itemPriceVariants).orderBy(itemPriceVariants.sortOrder),
    db.select().from(modifierGroups).orderBy(modifierGroups.sortOrder),
    db.select().from(modifierOptions).orderBy(modifierOptions.sortOrder),
    db.select().from(modifierGroupAttachments).orderBy(modifierGroupAttachments.sortOrder),
    db.select().from(itemModifierOptionExclusions),
    db.select().from(screens).orderBy(desc(screens.createdAt)),
    db.select().from(screenItems).orderBy(screenItems.sortOrder),
    db.select().from(displays).orderBy(desc(displays.createdAt)),
    db.select().from(displaySchedules),
  ]);

  // Mirrors venue.ts's `getOrCreateVenueSettingsRow`: the singleton row
  // always exists post-seed, but a from-scratch/test db shouldn't make this
  // read throw over a row every other Settings tab already auto-creates.
  let [settingsRow] = await db.select().from(venueSettings).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
  if (!settingsRow) {
    [settingsRow] = await db.insert(venueSettings).values({ id: VENUE_SETTINGS_ID }).returning();
  }

  const exportedDisplays: ExportedDisplay[] = displayRows.map((d) => ({
    id: d.id,
    name: d.name,
    screenId: d.screenId,
    pairedAt: d.pairedAt,
    lastSeenAt: d.lastSeenAt,
    revokedAt: d.revokedAt,
    createdAt: d.createdAt,
  }));

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    menu: {
      categories: categoryRows,
      tags: tagRows,
      items: itemRows,
      itemTags: itemTagRows,
      itemPriceVariants: itemPriceVariantRows,
      modifierGroups: modifierGroupRows,
      modifierOptions: modifierOptionRows,
      modifierGroupAttachments: modifierGroupAttachmentRows,
      itemModifierOptionExclusions: itemModifierOptionExclusionRows,
    },
    screens: {
      screens: screenRows,
      screenItems: screenItemRows,
    },
    displays: {
      displays: exportedDisplays,
      displaySchedules: displayScheduleRows,
    },
    settings: settingsRow,
  };
}
