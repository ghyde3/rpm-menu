// Bulk operations (PRD §3.1 "Bulk operations (admin UI)" + addendum §5.4).
// Every op is multi-select-items -> preview (dry run, no writes except a
// `pending_changes` row) -> apply (the real writes, each individually
// audited + screen-bumped). This is "the same code path Phase 2 chat
// confirmations will use" per §3.1/§4.1 -- a chat adapter can call
// `previewBulkOperation` + `applyBulkOperation` exactly like this admin UI
// does, swapping only `caller.surface`.
//
// Zod validation lives inline (this unit's owns_paths don't include
// src/lib/validation/**, mirroring the users.ts convention).
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { items, itemTags, type Item } from "@/db/schema";
import { uuidSchema, nullableCentsSchema } from "@/lib/validation/base";
import {
  requireOwnerCaller,
  requireStaffOrOwnerCaller,
  withAudit,
  bumpAffectedScreens,
  type DbClient,
  type ServiceCaller,
} from "./base";
import { NotFoundError } from "./base/errors";
import {
  createPendingChange,
  getFreshPendingChangeOrThrow,
  markPendingChangeApplied,
  type PendingChangeRow,
} from "./pending-changes";

// --- Validation -------------------------------------------------------

const itemIdsSchema = z.array(uuidSchema).min(1, "select at least one item");

export const bulkSetAvailabilityInputSchema = z.object({
  changeType: z.literal("bulk_set_availability"),
  itemIds: itemIdsSchema,
  isAvailable: z.boolean(),
});

/** Archive / restore a selection in one bulk group. `archived: true`
 * archives, `false` restores — mirrors `bulk_set_availability`'s boolean
 * shape. Staff-or-owner (archive hides items, it doesn't touch prices). */
export const bulkArchiveInputSchema = z.object({
  changeType: z.literal("bulk_archive"),
  itemIds: itemIdsSchema,
  archived: z.boolean(),
});

export const bulkSetCategoryInputSchema = z.object({
  changeType: z.literal("bulk_set_category"),
  itemIds: itemIdsSchema,
  categoryId: uuidSchema,
});

export const bulkTagInputSchema = z.object({
  changeType: z.literal("bulk_tag"),
  itemIds: itemIdsSchema,
  tagId: uuidSchema,
  action: z.enum(["add", "remove"]),
});

/** addendum §5.4: bulk price-adjust touches `items.price_cents` only, never
 * modifier deltas or happy-hour variants -- enforced below by skipping any
 * item that isn't `pricing_type = 'fixed'` with a non-null price. */
export const bulkPriceAdjustInputSchema = z
  .object({
    changeType: z.literal("bulk_price_adjust"),
    itemIds: itemIdsSchema,
    mode: z.enum(["flat", "percent"]),
    /** Signed integer cents delta, e.g. 50 = +$0.50, -50 = -$0.50. Required
     * (and only used) when `mode === "flat"`. */
    amountCents: z.number().int().optional(),
    /** Signed percent, e.g. 10 = +10%, -15 = -15%. Required (and only used)
     * when `mode === "percent"`. */
    percent: z.number().optional(),
  })
  .refine((v) => (v.mode === "flat" ? v.amountCents !== undefined : v.percent !== undefined), {
    message: "amountCents is required for mode=flat, percent is required for mode=percent",
  });

export const bulkOperationInputSchema = z.discriminatedUnion("changeType", [
  bulkSetAvailabilityInputSchema,
  bulkArchiveInputSchema,
  bulkSetCategoryInputSchema,
  bulkTagInputSchema,
  bulkPriceAdjustInputSchema,
]);
export type BulkOperationInput = z.infer<typeof bulkOperationInputSchema>;
export type BulkChangeType = BulkOperationInput["changeType"];

/** Exported so `src/lib/service/revert.ts` can gate a bulk-group revert with
 * the exact same rule that gated the original apply -- reverting a
 * price-adjust group is itself a price change, so it needs the same
 * owner-only floor. */
export function requireRoleForChangeType(caller: ServiceCaller, changeType: BulkChangeType): void {
  // PRD §2: staff cannot change prices -- every other bulk op is a normal
  // staff-or-owner catalog edit (availability/archive/category/tag), matching the
  // single-item equivalents in items.ts/tags.ts... except bulk_tag also
  // covers attaching *private* tags, which staff already manage per-item, so
  // staffOrOwner is correct there too (tag *definitions* are owner-only in
  // tags.ts; *attaching* an existing tag to items is not).
  if (changeType === "bulk_price_adjust") {
    requireOwnerCaller(caller);
  } else {
    requireStaffOrOwnerCaller(caller);
  }
}

// --- Preview diff shape -------------------------------------------------

export interface BulkDiffRow {
  itemId: string;
  name: string;
  /** True when this item is excluded from `apply` (already in the target
   * state, or -- for price adjust -- not a fixed-price item). */
  skipped: boolean;
  reason?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface BulkPreviewResult {
  pendingChangeId: string;
  changeType: BulkChangeType;
  expiresAt: Date;
  diff: BulkDiffRow[];
}

interface BulkPendingPayload {
  input: BulkOperationInput;
  diff: BulkDiffRow[];
}

async function loadItemsOrThrow(db: DbClient, itemIds: string[]): Promise<Map<string, Item>> {
  const rows = await db.select().from(items).where(inArray(items.id, itemIds));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = itemIds.find((id) => !byId.has(id));
  if (missing) throw new NotFoundError("item", missing);
  return byId;
}

const MAX_PRICE_CENTS = 10_000_00;

function computeAdjustedPrice(item: Item, input: Extract<BulkOperationInput, { changeType: "bulk_price_adjust" }>): { cents: number; reason?: string } | { cents: null; reason: string } {
  if (item.pricingType !== "fixed" || item.priceCents === null) {
    return { cents: null, reason: `pricing_type=${item.pricingType}, no fixed price to adjust` };
  }
  const raw =
    input.mode === "flat"
      ? item.priceCents + (input.amountCents as number)
      : Math.round(item.priceCents * (1 + (input.percent as number) / 100));
  if (raw < 0) return { cents: null, reason: "adjustment would result in a negative price" };
  if (raw > MAX_PRICE_CENTS) return { cents: null, reason: "adjustment would exceed the max allowed price" };
  return { cents: raw };
}

async function buildDiff(
  db: DbClient,
  input: BulkOperationInput,
  itemsById: Map<string, Item>,
): Promise<BulkDiffRow[]> {
  switch (input.changeType) {
    case "bulk_set_availability":
      return input.itemIds.map((itemId) => {
        const item = itemsById.get(itemId) as Item;
        const noop = item.isAvailable === input.isAvailable;
        return {
          itemId,
          name: item.name,
          skipped: noop,
          reason: noop ? "already in the target state" : undefined,
          before: { isAvailable: item.isAvailable },
          after: { isAvailable: input.isAvailable },
        };
      });

    case "bulk_archive":
      return input.itemIds.map((itemId) => {
        const item = itemsById.get(itemId) as Item;
        const currentlyArchived = item.archivedAt !== null;
        const noop = currentlyArchived === input.archived;
        return {
          itemId,
          name: item.name,
          skipped: noop,
          reason: noop ? (input.archived ? "already archived" : "already active") : undefined,
          before: { archived: currentlyArchived },
          after: { archived: input.archived },
        };
      });

    case "bulk_set_category":
      return input.itemIds.map((itemId) => {
        const item = itemsById.get(itemId) as Item;
        const noop = item.categoryId === input.categoryId;
        return {
          itemId,
          name: item.name,
          skipped: noop,
          reason: noop ? "already in the target category" : undefined,
          before: { categoryId: item.categoryId },
          after: { categoryId: input.categoryId },
        };
      });

    case "bulk_tag": {
      const tagRows = await db
        .select({ itemId: itemTags.itemId })
        .from(itemTags)
        .where(and(inArray(itemTags.itemId, input.itemIds), eq(itemTags.tagId, input.tagId)));
      const hasTag = new Set(tagRows.map((r) => r.itemId));
      return input.itemIds.map((itemId) => {
        const item = itemsById.get(itemId) as Item;
        const currentlyHas = hasTag.has(itemId);
        const noop = input.action === "add" ? currentlyHas : !currentlyHas;
        return {
          itemId,
          name: item.name,
          skipped: noop,
          reason: noop
            ? input.action === "add"
              ? "already has this tag"
              : "doesn't have this tag"
            : undefined,
          before: { hasTag: currentlyHas },
          after: { hasTag: input.action === "add" },
        };
      });
    }

    case "bulk_price_adjust":
      return input.itemIds.map((itemId) => {
        const item = itemsById.get(itemId) as Item;
        const result = computeAdjustedPrice(item, input);
        return {
          itemId,
          name: item.name,
          skipped: result.cents === null,
          reason: result.reason,
          before: { priceCents: item.priceCents },
          after: { priceCents: result.cents },
        };
      });
  }
}

/** Dry run: validates input, loads the target items, computes an old/new
 * diff per item (never writing to `items`), and stashes `{input, diff}` in a
 * new `pending_changes` row with a 15-minute expiry. Nothing here is
 * audited -- see pending-changes.ts's module doc. */
export async function previewBulkOperation(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: unknown,
): Promise<BulkPreviewResult> {
  const input = bulkOperationInputSchema.parse(rawInput);
  requireRoleForChangeType(caller, input.changeType);

  const itemsById = await loadItemsOrThrow(db, input.itemIds);
  const diff = await buildDiff(db, input, itemsById);

  const pending = await createPendingChange(db, caller, {
    changeType: input.changeType,
    payload: { input, diff } satisfies BulkPendingPayload,
  });

  return { pendingChangeId: pending.id, changeType: input.changeType, expiresAt: pending.expiresAt, diff };
}

export interface BulkApplyResult {
  pendingChangeId: string;
  changeType: BulkChangeType;
  appliedCount: number;
  skippedCount: number;
  itemIds: string[];
}

/** Applies a previously previewed bulk change: re-validates role + freshness
 * (`getFreshPendingChangeOrThrow` flips/rejects an expired preview), then
 * performs the real per-item writes inside one transaction, each wrapped in
 * `withAudit` under a shared group action name
 * (`"${changeType}:${pendingChangeId}"`) so `src/lib/service/revert.ts` can
 * revert the whole bulk group as a unit (§3.5: "Bulk operations revert as a
 * group") while still supporting one-off single-row revert of any
 * individual item in the batch. */
export async function applyBulkOperation(
  db: DbClient,
  caller: ServiceCaller,
  pendingChangeId: string,
): Promise<BulkApplyResult> {
  const pending = await getFreshPendingChangeOrThrow(db, pendingChangeId);
  const payload = pending.payload as unknown as BulkPendingPayload;
  const input = payload.input;
  requireRoleForChangeType(caller, input.changeType);

  return db.transaction(async (tx) => {
    const groupAction = `${input.changeType}:${pendingChangeId}`;
    let appliedCount = 0;
    let skippedCount = 0;
    const touchedItemIds: string[] = [];
    const touchedCategoryIds = new Set<string>();
    const touchedTagIds = new Set<string>();

    if (input.changeType === "bulk_set_availability") {
      for (const itemId of input.itemIds) {
        const [before] = await tx.select().from(items).where(eq(items.id, itemId));
        if (!before || before.isAvailable === input.isAvailable) {
          skippedCount++;
          continue;
        }
        await withAudit(
          tx,
          { actor: caller.actor, surface: caller.surface, action: groupAction, entityType: "item", entityId: itemId, before },
          async () => {
            const [after] = await tx
              .update(items)
              .set({ isAvailable: input.isAvailable, updatedAt: new Date() })
              .where(eq(items.id, itemId))
              .returning();
            return { result: after, after };
          },
        );
        appliedCount++;
        touchedItemIds.push(itemId);
        touchedCategoryIds.add(before.categoryId);
      }
    } else if (input.changeType === "bulk_archive") {
      for (const itemId of input.itemIds) {
        const [before] = await tx.select().from(items).where(eq(items.id, itemId));
        if (!before || (before.archivedAt !== null) === input.archived) {
          skippedCount++;
          continue;
        }
        await withAudit(
          tx,
          {
            actor: caller.actor,
            surface: caller.surface,
            action: groupAction,
            entityType: "item",
            entityId: itemId,
            before,
          },
          async () => {
            const [after] = await tx
              .update(items)
              .set({ archivedAt: input.archived ? new Date() : null, updatedAt: new Date() })
              .where(eq(items.id, itemId))
              .returning();
            return { result: after, after };
          },
        );
        appliedCount++;
        touchedItemIds.push(itemId);
        touchedCategoryIds.add(before.categoryId);
      }
    } else if (input.changeType === "bulk_set_category") {
      for (const itemId of input.itemIds) {
        const [before] = await tx.select().from(items).where(eq(items.id, itemId));
        if (!before || before.categoryId === input.categoryId) {
          skippedCount++;
          continue;
        }
        await withAudit(
          tx,
          { actor: caller.actor, surface: caller.surface, action: groupAction, entityType: "item", entityId: itemId, before },
          async () => {
            const [after] = await tx
              .update(items)
              .set({ categoryId: input.categoryId, updatedAt: new Date() })
              .where(eq(items.id, itemId))
              .returning();
            return { result: after, after };
          },
        );
        appliedCount++;
        touchedItemIds.push(itemId);
        touchedCategoryIds.add(before.categoryId);
        touchedCategoryIds.add(input.categoryId);
      }
    } else if (input.changeType === "bulk_tag") {
      for (const itemId of input.itemIds) {
        const [item] = await tx.select().from(items).where(eq(items.id, itemId));
        if (!item) {
          skippedCount++;
          continue;
        }
        const currentTagRows = await tx
          .select({ tagId: itemTags.tagId })
          .from(itemTags)
          .where(eq(itemTags.itemId, itemId));
        const currentTagIds = currentTagRows.map((r) => r.tagId);
        const currentlyHas = currentTagIds.includes(input.tagId);
        if (input.action === "add" ? currentlyHas : !currentlyHas) {
          skippedCount++;
          continue;
        }
        const newTagIds =
          input.action === "add"
            ? [...currentTagIds, input.tagId]
            : currentTagIds.filter((id) => id !== input.tagId);

        // Shape matches items.ts's setItemTags convention (`before: {
        // tagIds }`) on purpose -- src/lib/service/revert.ts special-cases
        // this shape to restore item_tags membership directly, since the
        // generic "item" revert handler (registered by items.ts) only owns
        // items-table row fields and intentionally no-ops for this shape.
        await withAudit(
          tx,
          {
            actor: caller.actor,
            surface: caller.surface,
            action: groupAction,
            entityType: "item",
            entityId: itemId,
            before: { tagIds: currentTagIds },
          },
          async () => {
            if (input.action === "add") {
              await tx.insert(itemTags).values({ itemId, tagId: input.tagId });
            } else {
              await tx.delete(itemTags).where(and(eq(itemTags.itemId, itemId), eq(itemTags.tagId, input.tagId)));
            }
            return { result: undefined, after: { tagIds: newTagIds } };
          },
        );
        appliedCount++;
        touchedItemIds.push(itemId);
        touchedTagIds.add(input.tagId);
      }
    } else {
      // bulk_price_adjust
      for (const itemId of input.itemIds) {
        const [before] = await tx.select().from(items).where(eq(items.id, itemId));
        if (!before) {
          skippedCount++;
          continue;
        }
        const result = computeAdjustedPrice(before, input);
        if (result.cents === null) {
          skippedCount++;
          continue;
        }
        const newCents = nullableCentsSchema.parse(result.cents);
        await withAudit(
          tx,
          { actor: caller.actor, surface: caller.surface, action: groupAction, entityType: "item", entityId: itemId, before },
          async () => {
            const [after] = await tx
              .update(items)
              .set({ priceCents: newCents, updatedAt: new Date() })
              .where(eq(items.id, itemId))
              .returning();
            return { result: after, after };
          },
        );
        appliedCount++;
        touchedItemIds.push(itemId);
        touchedCategoryIds.add(before.categoryId);
      }
    }

    await bumpAffectedScreens(tx, {
      itemIds: touchedItemIds,
      categoryIds: Array.from(touchedCategoryIds),
      tagIds: Array.from(touchedTagIds),
    });

    await markPendingChangeApplied(tx, pendingChangeId, {
      appliedCount,
      skippedCount,
      appliedAt: new Date().toISOString(),
    });

    return {
      pendingChangeId,
      changeType: input.changeType,
      appliedCount,
      skippedCount,
      itemIds: touchedItemIds,
    };
  });
}

export type { PendingChangeRow };
