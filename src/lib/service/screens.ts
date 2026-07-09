// Screens CRUD + manual-mode ordering (PRD §3.2, addendum §2). Every
// mutation: Zod-validate -> role-check -> write -> withAudit ->
// bumpAffectedScreens, per docs/architecture.md's "Service layer" contract.
//
// Role: PRD §2 — staff "cannot ... manage screens or users"; every screen
// mutation below is owner-only (unlike items/categories, which staff may
// also edit).
import { eq, inArray } from "drizzle-orm";
import { screens, screenItems, items } from "@/db/schema";
import {
  registerRevertHandler,
  requireOwnerCaller,
  withAudit,
  bumpAffectedScreens,
  reviveDates,
  type DbClient,
  type ServiceCaller,
} from "./base";
import { NotFoundError, ConflictError } from "./base/errors";
import {
  createScreenSchema,
  updateScreenSchema,
  setScreenItemsSchema,
  type CreateScreenInput,
  type UpdateScreenInput,
  type SetScreenItemsInput,
} from "@/lib/validation/screens";

// src/db/schema/screens.ts (foundation-owned) doesn't export row types the
// way catalog.ts does (`export type Item = ...`) — infer them here instead
// of editing that file. Re-exported so src/lib/screens/** and
// src/components/screens/** (same unit) can share one definition.
export type Screen = typeof screens.$inferSelect;
export type ScreenItem = typeof screenItems.$inferSelect;

async function getScreenOrThrow(db: DbClient, screenId: string): Promise<Screen> {
  const [screen] = await db.select().from(screens).where(eq(screens.id, screenId));
  if (!screen) throw new NotFoundError("screen", screenId);
  return screen;
}

export async function listScreens(db: DbClient): Promise<Screen[]> {
  return db.select().from(screens);
}

export async function getScreen(db: DbClient, screenId: string): Promise<Screen> {
  return getScreenOrThrow(db, screenId);
}

export async function createScreen(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateScreenInput,
): Promise<Screen> {
  requireOwnerCaller(caller);
  const input = createScreenSchema.parse(rawInput);

  const created = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_screen",
      entityType: "screen",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db.insert(screens).values(input).returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, { screenIds: [created.id] });
  return created;
}

export async function updateScreen(
  db: DbClient,
  caller: ServiceCaller,
  screenId: string,
  rawInput: UpdateScreenInput,
): Promise<Screen> {
  requireOwnerCaller(caller);
  const input = updateScreenSchema.parse(rawInput);
  const before = await getScreenOrThrow(db, screenId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_screen",
      entityType: "screen",
      entityId: screenId,
      before,
    },
    async () => {
      const [after] = await db
        .update(screens)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(screens.id, screenId))
        .returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, { screenIds: [screenId] });
  return updated;
}

/**
 * Deletes a screen. `screen_items` rows cascade (`ON DELETE CASCADE`);
 * `displays.screen_id` referencing this screen is set null (`ON DELETE SET
 * NULL`, src/db/schema/displays.ts) so a paired TV falls back to "no screen
 * assigned" rather than erroring — reassigning it is the displays unit's
 * concern, not this one's.
 */
export async function deleteScreen(db: DbClient, caller: ServiceCaller, screenId: string): Promise<void> {
  requireOwnerCaller(caller);
  const before = await getScreenOrThrow(db, screenId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_screen",
      entityType: "screen",
      entityId: screenId,
      before,
    },
    async () => {
      await db.delete(screens).where(eq(screens.id, screenId));
      return { result: undefined, after: null };
    },
  );
}

// --- Manual-mode item ordering (§3.2 "explicit ordered item list") --------

export async function listScreenItems(db: DbClient, screenId: string): Promise<ScreenItem[]> {
  return db.select().from(screenItems).where(eq(screenItems.screenId, screenId)).orderBy(screenItems.sortOrder);
}

/**
 * Full-replace of a manual-mode screen's ordered item list — order given by
 * array index, mirroring `setItemTags`'s full-replace convention in
 * src/lib/service/items.ts. Audited under `entity_type = "screen"` (there is
 * no standalone `screen_item` entity in the registry, same reasoning as item
 * tags — see src/db/schema/auditLog.ts).
 */
export async function setScreenItems(
  db: DbClient,
  caller: ServiceCaller,
  screenId: string,
  rawInput: SetScreenItemsInput,
): Promise<string[]> {
  requireOwnerCaller(caller);
  const input = setScreenItemsSchema.parse(rawInput);
  await getScreenOrThrow(db, screenId);

  if (input.itemIds.length > 0) {
    const foundRows = await db.select({ id: items.id }).from(items).where(inArray(items.id, input.itemIds));
    const foundIds = new Set(foundRows.map((r) => r.id));
    const missing = input.itemIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundError("item", missing[0]);
    }
  }

  const beforeRows = await listScreenItems(db, screenId);
  const beforeItemIds = beforeRows.map((r) => r.itemId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "set_screen_items",
      entityType: "screen",
      entityId: screenId,
      before: { itemIds: beforeItemIds },
    },
    async () => {
      await db.delete(screenItems).where(eq(screenItems.screenId, screenId));
      if (input.itemIds.length > 0) {
        await db
          .insert(screenItems)
          .values(input.itemIds.map((itemId, i) => ({ screenId, itemId, sortOrder: i })));
      }
      return { result: input.itemIds, after: { itemIds: input.itemIds } };
    },
  );

  await bumpAffectedScreens(db, { screenIds: [screenId] });
  return input.itemIds;
}

// --- Revert registration ----------------------------------------------
//
// `before === null` => the audited mutation was a create, so revert deletes
// the row. A `set_screen_items` audit row's `before` is `{ itemIds }`
// (manual-mode order snapshot, not a `screens` row) — restore that ordering
// directly rather than touching the `screens` table. Otherwise upsert the
// full `before` row back by id.
registerRevertHandler("screen", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("screen revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(screens).where(eq(screens.id, ctx.entityId));
    return;
  }
  const before = ctx.before as Record<string, unknown>;
  if ("itemIds" in before) {
    const itemIds = before.itemIds as string[];
    const screenId = ctx.entityId;
    await db.delete(screenItems).where(eq(screenItems.screenId, screenId));
    if (itemIds.length > 0) {
      await db.insert(screenItems).values(itemIds.map((itemId, i) => ({ screenId, itemId, sortOrder: i })));
    }
    return;
  }
  const beforeRow = reviveDates(before as unknown as Screen, ["createdAt", "updatedAt"]);
  const existing = await db.select({ id: screens.id }).from(screens).where(eq(screens.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(screens).values(beforeRow);
  } else {
    await db.update(screens).set(beforeRow).where(eq(screens.id, ctx.entityId));
  }
});
