// Preview -> apply plumbing shared by bulk ops (Phase 1, this file) and
// Phase 2 chat confirmations (§4.1/§4.2: "Bulk operations implement preview
// (dry-run) / apply as separate steps" + "Pending-changes table exists in
// schema ... reused for chat confirmations in Phase 2"). This module owns
// nothing but the `pending_changes` row lifecycle -- domain-specific preview
// diffing and apply mutations live in `src/lib/service/bulk-ops.ts`.
//
// Convention: `payload` is an opaque jsonb blob from this module's point of
// view. Callers (bulk-ops.ts today; a Phase 2 chat-adapter tomorrow) decide
// its shape per `changeType`. This file only manages status/expiry.
import { eq } from "drizzle-orm";
import { pendingChanges, type PendingChangeStatus } from "@/db/schema";
import { requireStaffOrOwnerCaller, type DbClient, type ServiceCaller } from "./base";
import { NotFoundError, ConflictError } from "./base/errors";

export type PendingChangeRow = typeof pendingChanges.$inferSelect;

/** PRD §3.1 "preview diff before apply" + this unit's spec: 15-minute expiry
 * on every pending change, regardless of `changeType`. */
export const PENDING_CHANGE_TTL_MS = 15 * 60 * 1000;

export interface CreatePendingChangeInput {
  changeType: string;
  payload: unknown;
  /** Override the default 15-minute TTL. Only ever used by tests. */
  ttlMs?: number;
}

/** Inserts a new `pending_changes` row in `status = "pending"`. Not itself
 * audited -- per §4.1 rule 3, a preview is a dry run over real code paths,
 * not a mutation of live data, so it leaves no audit_log row until/unless
 * it's applied. Requires at least staff-or-owner; callers that need a
 * stricter gate (e.g. bulk price adjust, owner-only per PRD §2) must call
 * `requireOwnerCaller` themselves before reaching here -- this is a floor,
 * not a ceiling. */
export async function createPendingChange(
  db: DbClient,
  caller: ServiceCaller,
  input: CreatePendingChangeInput,
): Promise<PendingChangeRow> {
  requireStaffOrOwnerCaller(caller);
  if (!input.changeType.trim()) {
    throw new ConflictError("changeType is required");
  }

  const [row] = await db
    .insert(pendingChanges)
    .values({
      actorId: caller.actor.type === "user" ? caller.actor.id : null,
      changeType: input.changeType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: input.payload as any,
      status: "pending",
      expiresAt: new Date(Date.now() + (input.ttlMs ?? PENDING_CHANGE_TTL_MS)),
    })
    .returning();
  return row;
}

/** Plain fetch-or-404. Does not check/flip expiry -- use
 * `getFreshPendingChangeOrThrow` for the apply path, this for read-only
 * lookups (e.g. resolving a bulk-group's `changeType` for a revert). */
export async function getPendingChange(db: DbClient, id: string): Promise<PendingChangeRow> {
  const [row] = await db.select().from(pendingChanges).where(eq(pendingChanges.id, id));
  if (!row) throw new NotFoundError("pending_change", id);
  return row;
}

export interface ListPendingChangesFilter {
  status?: PendingChangeStatus;
  changeType?: string;
}

export async function listPendingChanges(
  db: DbClient,
  filter: ListPendingChangesFilter = {},
): Promise<PendingChangeRow[]> {
  const rows = await db.select().from(pendingChanges);
  return rows
    .filter((r) => (filter.status ? r.status === filter.status : true))
    .filter((r) => (filter.changeType ? r.changeType === filter.changeType : true))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Fetch-or-404, lazily flipping `status` to `"expired"` if a still-`pending`
 * row's `expiresAt` has passed. Throws `ConflictError` unless the row is
 * (still) `pending` after that check -- the only status `apply` may proceed
 * from. This is the 15-minute-expiry enforcement point; there is no cron
 * sweep (no queues/schedulers in Phase 1 per docs/architecture.md), so
 * expiry is enforced lazily at the moment something tries to apply. */
export async function getFreshPendingChangeOrThrow(db: DbClient, id: string): Promise<PendingChangeRow> {
  let row = await getPendingChange(db, id);
  if (row.status === "pending" && row.expiresAt.getTime() < Date.now()) {
    const [expired] = await db
      .update(pendingChanges)
      .set({ status: "expired" })
      .where(eq(pendingChanges.id, id))
      .returning();
    row = expired;
  }
  if (row.status !== "pending") {
    throw new ConflictError(
      `Pending change is "${row.status}", not "pending" -- it can no longer be applied.`,
    );
  }
  return row;
}

/** Marks a pending change applied, optionally merging extra fields (e.g.
 * `appliedCount`, `appliedAt`) into its `payload` for later inspection (the
 * Recent Changes / bulk-group-revert flow reads `changeType` back off this
 * row -- see `src/lib/service/revert.ts`). Internal to the apply code path;
 * exported so `bulk-ops.ts` (and, later, a Phase 2 chat-confirmation apply
 * path) can call it directly inside the same transaction as the mutation. */
export async function markPendingChangeApplied(
  db: DbClient,
  id: string,
  payloadPatch: Record<string, unknown> = {},
): Promise<PendingChangeRow> {
  const current = await getPendingChange(db, id);
  const [row] = await db
    .update(pendingChanges)
    .set({
      status: "applied",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { ...(current.payload as object), ...payloadPatch } as any,
    })
    .where(eq(pendingChanges.id, id))
    .returning();
  return row;
}

/** Cancels a still-pending preview (the admin backed out before applying).
 * No-op-safe: throws if the row isn't `pending` so a stale double-click
 * can't "cancel" an already-applied change. */
export async function cancelPendingChange(
  db: DbClient,
  caller: ServiceCaller,
  id: string,
): Promise<PendingChangeRow> {
  requireStaffOrOwnerCaller(caller);
  const row = await getPendingChange(db, id);
  if (row.status !== "pending") {
    throw new ConflictError(`Pending change is "${row.status}", not "pending" -- nothing to cancel.`);
  }
  const [updated] = await db
    .update(pendingChanges)
    .set({ status: "cancelled" })
    .where(eq(pendingChanges.id, id))
    .returning();
  return updated;
}
