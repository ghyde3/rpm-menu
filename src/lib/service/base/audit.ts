// The mandatory audit wrapper (§3.5, §4.2). Every service-layer mutation
// function calls `withAudit` around its write so admin UI, REST API, and MCP
// handlers get identical audit behavior for free — no feature unit writes to
// `audit_log` directly.
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
