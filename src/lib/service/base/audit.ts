// The mandatory audit wrapper (§3.5, §4.2). Every service-layer mutation
// function calls `withAudit` around its write so admin UI, REST API, and MCP
// handlers get identical audit behavior for free — no feature unit writes to
// `audit_log` directly.
import { eq } from "drizzle-orm";
import { auditLog, type EntityType, type Surface } from "@/db/schema";
import type { Actor } from "./actor";
import type { DbClient } from "./db-client";

export interface AuditMeta {
  actor: Actor;
  surface: Surface;
  /** Short verb-ish action name, e.g. "set_availability", "update_item". Per
   * plan conventions this should match the service function name 1:1 with
   * the REST intent / MCP tool name (§3.7). */
  action: string;
  entityType: EntityType;
  entityId: string | null;
  /** Entity state before the mutation (or null for creates). */
  before: unknown;
}

export interface WithAuditOutcome<T> {
  result: T;
  /** Entity state after the mutation (or null for deletes). */
  after: unknown;
}

/** Inserts one row into `audit_log`. Prefer `withAudit` from service
 * functions; call this directly only for audit-only events with no
 * accompanying mutation result to return. */
export async function writeAuditLog(
  db: DbClient,
  meta: AuditMeta & { after: unknown },
): Promise<void> {
  await db.insert(auditLog).values({
    actorType: meta.actor.type,
    actorId: meta.actor.id,
    surface: meta.surface,
    action: meta.action,
    entityType: meta.entityType,
    entityId: meta.entityId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    before: meta.before as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    after: meta.after as any,
  });
}

/**
 * Runs `fn` (the actual DB mutation), then writes the audit row with the
 * `before` value supplied by the caller and the `after` value `fn` returns.
 * Run inside a `db.transaction(...)` when the mutation and the audit row
 * must commit atomically (recommended for anything non-trivial).
 *
 * ```ts
 * return withAudit(db, {
 *   actor, surface, action: "set_availability", entityType: "item",
 *   entityId: item.id, before: item,
 * }, async () => {
 *   const [after] = await db.update(items).set({ isAvailable }).where(eq(items.id, item.id)).returning();
 *   return { result: after, after };
 * });
 * ```
 */
export async function withAudit<T>(
  db: DbClient,
  meta: AuditMeta,
  fn: () => Promise<WithAuditOutcome<T>>,
): Promise<T> {
  const { result, after } = await fn();
  await writeAuditLog(db, { ...meta, after });
  return result;
}

// --- Revert -----------------------------------------------------------
//
// `revertAuditEntry` is generic over entity type: it looks up the audit row,
// finds the revert handler its owning domain module registered, and hands
// that handler the row's `before`/`after`/`entityId` to restore. Domain
// service modules (items.ts, categories.ts, ...) register their handler once
// at import time via `registerRevertHandler` — the same
// register-a-factory-at-import-time pattern as
// `src/lib/storage/interface.ts`'s `registerStorageDriver` — so this module
// never needs to import every domain's Drizzle table.

export interface RevertContext {
  /** `audit_log.entity_id` for the row being reverted (may be null for
   * singleton-style entities that never carried one). */
  entityId: string | null;
  /** `audit_log.before` — what the handler should restore as current state.
   * `null` means the original mutation was a create, so "revert" means
   * delete. */
  before: unknown;
  /** `audit_log.after` — what is (expected to still be) current state before
   * the revert runs. `null` means the original mutation was a delete, so
   * "revert" means re-insert `before`. */
  after: unknown;
}

export type RevertHandler = (db: DbClient, ctx: RevertContext) => Promise<void>;

const revertHandlers = new Map<EntityType, RevertHandler>();

/** Registers the revert handler for one `entity_type`. Call once at module
 * load from the domain service file that owns that entity's table(s). */
export function registerRevertHandler(entityType: EntityType, handler: RevertHandler): void {
  revertHandlers.set(entityType, handler);
}

export class RevertError extends Error {}

/**
 * Restores the entity state captured in `audit_log.before` for one audit
 * row, then writes a *new* audit row recording the revert itself (so revert
 * is itself audited/revertable, per §7's "worst case is a one-click undo").
 *
 * Throws `RevertError` if the audit row doesn't exist or no domain module
 * registered a handler for its `entity_type` (the owning service module
 * must be imported somewhere on the revert code path for its
 * `registerRevertHandler` call to have run).
 */
export async function revertAuditEntry(
  db: DbClient,
  auditEntryId: string,
  meta: { actor: Actor; surface: Surface },
): Promise<void> {
  const [entry] = await db.select().from(auditLog).where(eq(auditLog.id, auditEntryId));
  if (!entry) {
    throw new RevertError(`audit_log row not found: ${auditEntryId}`);
  }

  const entityType = entry.entityType as EntityType;
  const handler = revertHandlers.get(entityType);
  if (!handler) {
    throw new RevertError(
      `No revert handler registered for entity_type="${entityType}". Import the owning ` +
        `service module (e.g. "@/lib/service/items") once before calling revertAuditEntry.`,
    );
  }

  await handler(db, { entityId: entry.entityId, before: entry.before, after: entry.after });

  await writeAuditLog(db, {
    actor: meta.actor,
    surface: meta.surface,
    action: `revert:${entry.action}`,
    entityType,
    entityId: entry.entityId,
    before: entry.after,
    after: entry.before,
  });
}
