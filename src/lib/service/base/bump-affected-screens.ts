// The single, shared "something changed, tell the screens" side effect
// (§5.3). Every service function that mutates items/categories/tags/
// modifiers/schedules must call this instead of inventing its own version
// bump — otherwise screens/public-menu silently go stale (see plan risks).
import { inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { screens, screenItems } from "@/db/schema";
import type { DbClient } from "./db-client";

export interface AffectedScope {
  /** Items whose availability/price/tags/category changed. */
  itemIds?: string[];
  /** Categories whose config or membership changed. */
  categoryIds?: string[];
  /** Tags whose attachment to items changed. */
  tagIds?: string[];
  /** Screens to bump directly regardless of source_mode (e.g. the screen's
   * own definition just changed). */
  screenIds?: string[];
}

/**
 * Bumps `screens.version` for:
 *   - every screen id in `scope.screenIds`,
 *   - every query-mode screen whose `source_config.tagIds` /
 *     `source_config.categoryIds` intersects the scope, and
 *   - every manual-mode screen that lists one of `scope.itemIds` in
 *     `screen_items`.
 * Then revalidates the public menu route. Returns the bumped screen ids.
 */
export async function bumpAffectedScreens(db: DbClient, scope: AffectedScope): Promise<string[]> {
  const affected = new Set<string>(scope.screenIds ?? []);

  if (scope.tagIds?.length || scope.categoryIds?.length) {
    const queryScreens = await db
      .select({ id: screens.id, sourceMode: screens.sourceMode, sourceConfig: screens.sourceConfig })
      .from(screens);

    for (const screen of queryScreens) {
      if (screen.sourceMode !== "query") continue;
      const cfg = screen.sourceConfig ?? {};
      const tagHit = Boolean(scope.tagIds?.some((t) => cfg.tagIds?.includes(t)));
      const catHit = Boolean(scope.categoryIds?.some((c) => cfg.categoryIds?.includes(c)));
      if (tagHit || catHit) affected.add(screen.id);
    }
  }

  if (scope.itemIds?.length) {
    const manualHits = await db
      .select({ screenId: screenItems.screenId })
      .from(screenItems)
      .where(inArray(screenItems.itemId, scope.itemIds));
    for (const row of manualHits) affected.add(row.screenId);
  }

  if (affected.size > 0) {
    await db
      .update(screens)
      .set({ version: sql`${screens.version} + 1`, updatedAt: new Date() })
      .where(inArray(screens.id, Array.from(affected)));
  }

  try {
    // No-op (and safe to ignore) outside a Next.js request scope, e.g. when
    // called from scripts/seed/** via tsx.
    revalidatePath("/menu");
  } catch {
    // intentionally ignored
  }

  return Array.from(affected);
}
