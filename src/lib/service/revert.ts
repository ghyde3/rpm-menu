// The audit/revert surface (PRD §3.5): the "Recent changes" feed
// (filterable by user/entity) plus one-click single-entity and bulk-group
// revert.
//
// Side-effect imports below: `registerRevertHandler` (src/lib/service/base/
// audit.ts) runs at module load time for each domain service file. Nothing
// here should assume some *other* request already warmed those modules --
// import every domain module that currently registers a handler so a
// revert works the first time this module is touched in a fresh process,
// per audit.ts's own doc comment ("the owning service module must be
// imported somewhere on the revert code path").
import "@/lib/service/items";
import "@/lib/service/categories";
import "@/lib/service/tags";
import "@/lib/service/modifiers";
import "@/lib/service/users";
import "@/lib/service/settings/venue";

import { desc, eq, inArray } from "drizzle-orm";
import { auditLog, itemTags, users, type ActorType, type EntityType } from "@/db/schema";
import {
  requireOwnerCaller,
  requireStaffOrOwnerCaller,
  revertAuditEntry,
  bumpAffectedScreens,
  type Actor,
  type DbClient,
  type ServiceCaller,
} from "./base";
import { NotFoundError, ConflictError } from "./base/errors";
import { getPendingChange } from "./pending-changes";
import { requireRoleForChangeType, type BulkChangeType } from "./bulk-ops";

export type AuditLogRow = typeof auditLog.$inferSelect;

export interface RecentChangeEntry extends AuditLogRow {
  actorName: string | null;
  /** Present when `action` matches the `"<changeType>:<pendingChangeId>"`
   * shape bulk-ops.ts writes -- lets the UI show "part of a bulk change"
   * and offer a group-revert action alongside the per-row one. */
  bulkGroup: { changeType: string; pendingChangeId: string } | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBulkGroupAction(action: string): { changeType: string; pendingChangeId: string } | null {
  const idx = action.lastIndexOf(":");
  if (idx === -1) return null;
  const changeType = action.slice(0, idx);
  const pendingChangeId = action.slice(idx + 1);
  if (!UUID_RE.test(pendingChangeId)) return null;
  return { changeType, pendingChangeId };
}

// --- Recent changes feed ------------------------------------------------

export interface ListRecentChangesFilter {
  actorId?: string;
  entityType?: EntityType;
  limit?: number;
  offset?: number;
}

/** The "Recent changes" feed (§3.5), filterable by user/entity. Any staff-or-
 * owner admin may read it -- filtering/reverting an *action* is what's
 * role-gated, not looking at the log. */
export async function listRecentChanges(
  db: DbClient,
  caller: ServiceCaller,
  filter: ListRecentChangesFilter = {},
): Promise<RecentChangeEntry[]> {
  requireStaffOrOwnerCaller(caller);
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  // Filtered + paginated in JS rather than SQL: audit_log at this venue's
  // scale is trivial (per §3.5 "retention: keep everything; volume is
  // trivial"), and filtering must happen before paging or a filtered page
  // would silently under-fill. Revisit with a real WHERE + LIMIT/OFFSET if
  // volume ever justifies it -- capped at 2000 most-recent rows as a floor
  // against an unbounded scan either way.
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(2000);

  const page = rows
    .filter((r) => {
      if (filter.actorId && r.actorId !== filter.actorId) return false;
      if (filter.entityType && r.entityType !== filter.entityType) return false;
      return true;
    })
    .slice(offset, offset + limit);

  // Backfill entity_id for any create-shaped row this page surfaces (see
  // `withBackfilledEntityId`'s doc) so the feed's entries are consistently
  // clickable/revertable rather than only becoming so the first time
  // someone happens to open the individual revert action.
  const filtered = await Promise.all(page.map((r) => withBackfilledEntityId(db, r)));

  const actorIds = Array.from(
    new Set(filtered.filter((r) => r.actorType === "user" && r.actorId).map((r) => r.actorId as string)),
  );
  const actorRows = actorIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds))
    : [];
  const nameById = new Map(actorRows.map((u) => [u.id, u.name]));

  return filtered.map((r) => ({
    ...r,
    actorName: r.actorType === "user" && r.actorId ? (nameById.get(r.actorId) ?? null) : null,
    bulkGroup: parseBulkGroupAction(r.action),
  }));
}

export interface ChangeActor {
  id: string;
  name: string;
  actorType: ActorType;
}

/** Distinct users for the feed's "filter by user" dropdown. System/display
 * actors aren't user rows, so the filter UI treats them as separate,
 * unnamed buckets (actorId stays a raw uuid/null in the filter). */
export async function listChangeActors(db: DbClient, caller: ServiceCaller): Promise<ChangeActor[]> {
  requireStaffOrOwnerCaller(caller);
  const rows = await db.select({ id: users.id, name: users.name }).from(users);
  return rows.map((r) => ({ id: r.id, name: r.name, actorType: "user" as const }));
}

// --- Revert --------------------------------------------------------------

/** `items.ts`'s registered "item" revert handler intentionally no-ops when
 * `before` carries a `{ tagIds }` shape (a `set_item_tags`/`bulk_tag` audit
 * row is not a row-level `items` change -- it only owns membership in
 * `item_tags`, a table the generic handler never touches). Restoring that
 * membership is this unit's job, not items.ts's, so this file special-cases
 * the shape here rather than delegating to `revertAuditEntry` for it. */
function isTagSetShape(value: unknown): value is { tagIds: string[] } {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as Record<string, unknown>).tagIds) &&
    (value as Record<string, unknown>).tagIds !== undefined
  );
}

async function restoreItemTagMembership(db: DbClient, itemId: string, tagIds: string[]): Promise<void> {
  await db.delete(itemTags).where(eq(itemTags.itemId, itemId));
  if (tagIds.length > 0) {
    await db.insert(itemTags).values(tagIds.map((tagId) => ({ itemId, tagId })));
  }
}

function priceChanged(before: unknown, after: unknown): boolean {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return false;
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  if (!("priceCents" in b) || !("priceCents" in a)) return false;
  return b.priceCents !== a.priceCents;
}

/** Per-entity-type floor for "who may revert this row" -- mirrors each
 * domain service's own mutation gating (tags.ts/users.ts/settings/venue.ts
 * are owner-only for every mutation; categories.ts/modifiers.ts are
 * staff-or-owner). Entity types not yet built by any unit default to
 * owner-only (the conservative floor) until their owning unit's service
 * registers a real gate here. */
const ENTITY_REVERT_ROLE: Partial<Record<EntityType, "owner" | "staffOrOwner">> = {
  category: "staffOrOwner",
  tag: "owner",
  modifier_group: "staffOrOwner",
  modifier_option: "staffOrOwner",
  modifier_group_attachment: "staffOrOwner",
  item_modifier_option_exclusion: "staffOrOwner",
  user: "owner",
  setting: "owner",
};

function requireRevertRole(caller: ServiceCaller, entry: AuditLogRow): void {
  if (entry.entityType === "item") {
    // Reverting a create = delete, and reverting a delete re-inserts a full
    // priced row -- both mirror items.ts's unconditional owner-only delete
    // gate (PRD §2: "staff cannot ... delete items").
    if (entry.action === "delete_item" || entry.action === "create_item" || entry.before === null) {
      requireOwnerCaller(caller);
      return;
    }
    const group = parseBulkGroupAction(entry.action);
    if (group) {
      requireRoleForChangeType(caller, group.changeType as BulkChangeType);
      return;
    }
    if (priceChanged(entry.before, entry.after)) {
      requireOwnerCaller(caller);
      return;
    }
    requireStaffOrOwnerCaller(caller);
    return;
  }

  const rule = ENTITY_REVERT_ROLE[entry.entityType] ?? "owner";
  if (rule === "owner") requireOwnerCaller(caller);
  else requireStaffOrOwnerCaller(caller);
}

async function bumpForRevertedEntry(db: DbClient, entry: AuditLogRow): Promise<void> {
  // `revertAuditEntry`/our own tag restore write the DB row but don't bump
  // screens (§5.3's shared side effect) -- do it here so a reverted
  // availability/price/category/tag change actually propagates to
  // query-mode screens and /menu, same as the original mutation did.
  if (!entry.entityId) return;
  if (entry.entityType === "item") {
    await bumpAffectedScreens(db, { itemIds: [entry.entityId] });
  } else if (entry.entityType === "category") {
    await bumpAffectedScreens(db, { categoryIds: [entry.entityId] });
  } else if (entry.entityType === "tag") {
    await bumpAffectedScreens(db, { tagIds: [entry.entityId] });
  }
}

async function getAuditEntryOrThrow(db: DbClient, auditEntryId: string): Promise<AuditLogRow> {
  const [entry] = await db.select().from(auditLog).where(eq(auditLog.id, auditEntryId));
  if (!entry) throw new NotFoundError("audit_log", auditEntryId);
  return entry;
}

/** Every domain service's `create_*` mutation writes its audit row with
 * `entityId: null` -- the id doesn't exist yet when the `withAudit` meta
 * object is built, and `withAudit`'s (base/audit.ts) signature has no way
 * to backfill it from the mutation's own return value. That leaves
 * `revertAuditEntry`'s per-domain handlers unable to revert (= delete) a
 * create: every one of them throws on a null `entityId` (see items.ts's
 * "item revert requires an entity_id"). Since `entry.after` for a create is
 * the full inserted row -- which does carry its own `id` -- this backfills
 * `audit_log.entity_id` once, in place, the first time a create-shaped row
 * is looked up for revert. This is a data-quality correction (every other
 * read of this row, e.g. the Recent Changes feed, benefits too), not a
 * new field or schema change. */
async function withBackfilledEntityId(db: DbClient, entry: AuditLogRow): Promise<AuditLogRow> {
  if (entry.entityId !== null || entry.before !== null) return entry;
  const after = entry.after;
  if (!after || typeof after !== "object" || typeof (after as Record<string, unknown>).id !== "string") {
    return entry;
  }
  const derivedId = (after as Record<string, unknown>).id as string;
  const [updated] = await db
    .update(auditLog)
    .set({ entityId: derivedId })
    .where(eq(auditLog.id, entry.id))
    .returning();
  return updated ?? entry;
}

/** Reverts one audit row: role-gated per `requireRevertRole`, then either
 * the tag-membership special case above or the shared generic
 * `revertAuditEntry` dispatcher (base/audit.ts), followed by a screens
 * bump. `revertAuditEntry` already writes its own compensating,
 * itself-revertable audit row (§3.5: "writes a compensating change, also
 * audited") -- this function does the same for the tag-membership case. */
export async function revertChange(db: DbClient, caller: ServiceCaller, auditEntryId: string): Promise<void> {
  const entry = await withBackfilledEntityId(db, await getAuditEntryOrThrow(db, auditEntryId));
  requireRevertRole(caller, entry);

  const meta: { actor: Actor; surface: ServiceCaller["surface"] } = { actor: caller.actor, surface: caller.surface };

  await db.transaction(async (tx) => {
    if (entry.entityType === "item" && isTagSetShape(entry.before)) {
      if (!entry.entityId) throw new ConflictError("item tag revert requires an entity_id");
      const restoredTagIds = entry.before.tagIds;
      await restoreItemTagMembership(tx, entry.entityId, restoredTagIds);
      await tx.insert(auditLog).values({
        actorType: meta.actor.type,
        actorId: meta.actor.id,
        surface: meta.surface,
        action: `revert:${entry.action}`,
        entityType: "item",
        entityId: entry.entityId,
        before: entry.after,
        after: entry.before,
      });
    } else {
      await revertAuditEntry(tx, entry.id, meta);
    }
    await bumpForRevertedEntry(tx, entry);
  });
}

export interface RevertBulkGroupResult {
  pendingChangeId: string;
  changeType: string;
  revertedCount: number;
}

/** Reverts every audit row written by one bulk-ops `apply` call as a group
 * (§3.5: "Bulk operations revert as a group"), in reverse-chronological
 * order. Requires the pending change to be `"applied"` -- reverting a
 * preview that was never applied, or one that's already expired/cancelled,
 * makes no sense. */
export async function revertBulkGroup(
  db: DbClient,
  caller: ServiceCaller,
  pendingChangeId: string,
): Promise<RevertBulkGroupResult> {
  const pending = await getPendingChange(db, pendingChangeId);
  if (pending.status !== "applied") {
    throw new ConflictError(`Pending change is "${pending.status}", not "applied" -- there is nothing to revert.`);
  }
  requireRoleForChangeType(caller, pending.changeType as BulkChangeType);

  const groupAction = `${pending.changeType}:${pendingChangeId}`;
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, groupAction))
    .orderBy(desc(auditLog.createdAt));

  if (rows.length === 0) {
    throw new NotFoundError("bulk change audit rows", pendingChangeId);
  }

  const meta: { actor: Actor; surface: ServiceCaller["surface"] } = { actor: caller.actor, surface: caller.surface };

  await db.transaction(async (tx) => {
    for (const entry of rows) {
      if (entry.entityType === "item" && isTagSetShape(entry.before)) {
        if (!entry.entityId) continue;
        await restoreItemTagMembership(tx, entry.entityId, entry.before.tagIds);
        await tx.insert(auditLog).values({
          actorType: meta.actor.type,
          actorId: meta.actor.id,
          surface: meta.surface,
          action: `revert:${entry.action}`,
          entityType: "item",
          entityId: entry.entityId,
          before: entry.after,
          after: entry.before,
        });
      } else {
        await revertAuditEntry(tx, entry.id, meta);
      }
      await bumpForRevertedEntry(tx, entry);
    }
  });

  return { pendingChangeId, changeType: pending.changeType, revertedCount: rows.length };
}
