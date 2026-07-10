// Multi-photo gallery per menu item (M4 addendum). `items.imageId` remains
// the denormalized "hero" pointer every existing render path already reads —
// this module is the only writer of that column going forward, kept in sync
// (via `syncItemHeroImage`) with whichever gallery row currently carries
// `is_primary`. Every mutation: Zod-validate -> role-check -> write ->
// withAudit -> bumpAffectedScreens, per docs/architecture.md's "Service
// layer" contract, entityType `"item_image"`, entityId = the item whose
// gallery changed, before/after = that item's full ordered gallery (an array
// of raw `item_images` rows, not the joined display shape) so revert can
// restore membership + order + primary in one shot.
import { and, asc, eq, inArray } from "drizzle-orm";
import { images, items, itemImages, type ImageVariants, type ItemImage } from "@/db/schema";
import {
  registerRevertHandler,
  requireStaffOrOwnerCaller,
  withAudit,
  bumpAffectedScreens,
  reviveDates,
  type DbClient,
  type ServiceCaller,
} from "./base";
import { NotFoundError, ConflictError } from "./base/errors";
import {
  addItemImageSchema,
  reorderItemImagesSchema,
  setPrimaryItemImageSchema,
  removeItemImageSchema,
  type AddItemImageInput,
  type ReorderItemImagesInput,
  type SetPrimaryItemImageInput,
  type RemoveItemImageInput,
} from "@/lib/validation/item-images";

/** Display shape for the gallery UI / render surfaces: the raw `item_images`
 * row's identity + ordering fields, joined with the `images` row's storage
 * key and pre-computed variant URLs (so callers never need a second query
 * per image). */
export interface ItemImageGalleryEntry {
  id: string;
  imageId: string;
  key: string;
  variants: ImageVariants;
  sortOrder: number;
  isPrimary: boolean;
}

async function assertItemExists(db: DbClient, itemId: string): Promise<void> {
  const [row] = await db.select({ id: items.id }).from(items).where(eq(items.id, itemId));
  if (!row) throw new NotFoundError("item", itemId);
}

async function assertImageExists(db: DbClient, imageId: string): Promise<void> {
  const [row] = await db.select({ id: images.id }).from(images).where(eq(images.id, imageId));
  if (!row) throw new NotFoundError("image", imageId);
}

/** Raw gallery rows for one item, ordered — this (not the joined display
 * shape) is what gets captured into `audit_log.before`/`after` and what the
 * revert handler restores verbatim. */
async function getGalleryRows(db: DbClient, itemId: string): Promise<ItemImage[]> {
  return db.select().from(itemImages).where(eq(itemImages.itemId, itemId)).orderBy(asc(itemImages.sortOrder));
}

async function getGalleryEntries(db: DbClient, itemId: string): Promise<ItemImageGalleryEntry[]> {
  return db
    .select({
      id: itemImages.id,
      imageId: itemImages.imageId,
      sortOrder: itemImages.sortOrder,
      isPrimary: itemImages.isPrimary,
      key: images.key,
      variants: images.variants,
    })
    .from(itemImages)
    .innerJoin(images, eq(itemImages.imageId, images.id))
    .where(eq(itemImages.itemId, itemId))
    .orderBy(asc(itemImages.sortOrder));
}

/** Sets `items.image_id` to whichever gallery row is currently primary for
 * `itemId` (or `null` if the gallery has none) — the one place this module
 * touches the `items` table directly, per the addendum's "keep items.imageId
 * as the denormalized hero pointer" contract. Deliberately does NOT go
 * through items.ts's own `updateItem` (that would double-audit under
 * `entity_type = "item"` for what is really an `item_image` mutation's side
 * effect) — this is a direct, unaudited sync write, exactly like items.ts's
 * own `featuredSlotKey` swap only audits the `items` row it directly
 * intends to change.
 */
async function syncItemHeroImage(db: DbClient, itemId: string): Promise<void> {
  const [primary] = await db
    .select({ imageId: itemImages.imageId })
    .from(itemImages)
    .where(and(eq(itemImages.itemId, itemId), eq(itemImages.isPrimary, true)));

  await db
    .update(items)
    .set({ imageId: primary?.imageId ?? null, updatedAt: new Date() })
    .where(eq(items.id, itemId));
}

// --- Reads ----------------------------------------------------------------

export async function listItemImages(db: DbClient, itemId: string): Promise<ItemImageGalleryEntry[]> {
  return getGalleryEntries(db, itemId);
}

/** Batch variant for render paths (screens/public-menu) that need galleries
 * for many items at once — one join query instead of N. Keyed by `itemId`;
 * items with no gallery rows are simply absent from the map (callers should
 * treat a missing key the same as an empty array). */
export async function listItemImagesForItems(
  db: DbClient,
  itemIds: string[],
): Promise<Map<string, ItemImageGalleryEntry[]>> {
  const result = new Map<string, ItemImageGalleryEntry[]>();
  if (itemIds.length === 0) return result;

  const rows = await db
    .select({
      itemId: itemImages.itemId,
      id: itemImages.id,
      imageId: itemImages.imageId,
      sortOrder: itemImages.sortOrder,
      isPrimary: itemImages.isPrimary,
      key: images.key,
      variants: images.variants,
    })
    .from(itemImages)
    .innerJoin(images, eq(itemImages.imageId, images.id))
    .where(inArray(itemImages.itemId, itemIds))
    .orderBy(asc(itemImages.itemId), asc(itemImages.sortOrder));

  for (const { itemId, ...entry } of rows) {
    const bucket = result.get(itemId);
    if (bucket) bucket.push(entry);
    else result.set(itemId, [entry]);
  }
  return result;
}

// --- Writes -----------------------------------------------------------

/** Appends `imageId` to the end of `itemId`'s gallery. The first image ever
 * added to an item is automatically marked primary and synced onto
 * `items.imageId` — every subsequent add just appends. */
export async function addItemImage(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: AddItemImageInput,
): Promise<ItemImageGalleryEntry[]> {
  requireStaffOrOwnerCaller(caller);
  const input = addItemImageSchema.parse(rawInput);

  return db.transaction(async (tx) => {
    await assertItemExists(tx, itemId);
    await assertImageExists(tx, input.imageId);
    const before = await getGalleryRows(tx, itemId);
    const isFirst = before.length === 0;
    const nextSortOrder = before.length === 0 ? 0 : Math.max(...before.map((r) => r.sortOrder)) + 1;

    await withAudit(
      tx,
      {
        actor: caller.actor,
        surface: caller.surface,
        action: "add_item_image",
        entityType: "item_image",
        entityId: itemId,
        before,
      },
      async () => {
        await tx.insert(itemImages).values({
          itemId,
          imageId: input.imageId,
          sortOrder: nextSortOrder,
          isPrimary: isFirst,
        });
        const after = await getGalleryRows(tx, itemId);
        return { result: after, after };
      },
    );

    if (isFirst) await syncItemHeroImage(tx, itemId);
    await bumpAffectedScreens(tx, { itemIds: [itemId] });
    return getGalleryEntries(tx, itemId);
  });
}

/** Removes one gallery row. If it was primary, the next image by ascending
 * `sortOrder` is promoted (or `items.imageId` is cleared to `null` if none
 * remain). */
export async function removeItemImage(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: RemoveItemImageInput,
): Promise<ItemImageGalleryEntry[]> {
  requireStaffOrOwnerCaller(caller);
  const input = removeItemImageSchema.parse(rawInput);

  return db.transaction(async (tx) => {
    const before = await getGalleryRows(tx, itemId);
    const target = before.find((r) => r.id === input.itemImageId);
    if (!target) throw new NotFoundError("item_image", input.itemImageId);

    await withAudit(
      tx,
      {
        actor: caller.actor,
        surface: caller.surface,
        action: "remove_item_image",
        entityType: "item_image",
        entityId: itemId,
        before,
      },
      async () => {
        await tx.delete(itemImages).where(eq(itemImages.id, input.itemImageId));

        if (target.isPrimary) {
          const [promoted] = before
            .filter((r) => r.id !== input.itemImageId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          if (promoted) {
            await tx.update(itemImages).set({ isPrimary: true }).where(eq(itemImages.id, promoted.id));
          }
        }

        const after = await getGalleryRows(tx, itemId);
        return { result: after, after };
      },
    );

    if (target.isPrimary) await syncItemHeroImage(tx, itemId);
    await bumpAffectedScreens(tx, { itemIds: [itemId] });
    return getGalleryEntries(tx, itemId);
  });
}

/** Full-replace ordering: `orderedItemImageIds` must be exactly `itemId`'s
 * current gallery membership (same ids, no more no less) — rejects with
 * `ConflictError` otherwise rather than silently dropping/ignoring stray
 * ids. */
export async function reorderItemImages(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: ReorderItemImagesInput,
): Promise<ItemImageGalleryEntry[]> {
  requireStaffOrOwnerCaller(caller);
  const input = reorderItemImagesSchema.parse(rawInput);

  return db.transaction(async (tx) => {
    const before = await getGalleryRows(tx, itemId);
    const beforeIds = new Set(before.map((r) => r.id));
    const inputIds = new Set(input.orderedItemImageIds);
    const sameMembership =
      input.orderedItemImageIds.length === before.length &&
      beforeIds.size === inputIds.size &&
      [...beforeIds].every((id) => inputIds.has(id));
    if (!sameMembership) {
      throw new ConflictError("orderedItemImageIds must be exactly the item's current gallery membership");
    }

    await withAudit(
      tx,
      {
        actor: caller.actor,
        surface: caller.surface,
        action: "reorder_item_images",
        entityType: "item_image",
        entityId: itemId,
        before,
      },
      async () => {
        for (let i = 0; i < input.orderedItemImageIds.length; i++) {
          await tx.update(itemImages).set({ sortOrder: i }).where(eq(itemImages.id, input.orderedItemImageIds[i]));
        }
        const after = await getGalleryRows(tx, itemId);
        return { result: after, after };
      },
    );

    await bumpAffectedScreens(tx, { itemIds: [itemId] });
    return getGalleryEntries(tx, itemId);
  });
}

/**
 * Reassigns which gallery row is primary as a single transaction: clears
 * whichever row currently holds it, sets it on `itemImageId`, then syncs
 * `items.imageId`. Mirrors items.ts's `setFeaturedSlot` swap discipline —
 * required so the partial-unique-index invariant ("exactly one primary per
 * item") is never violated by a read-then-write race between two admin
 * tabs.
 */
export async function setPrimaryItemImage(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: SetPrimaryItemImageInput,
): Promise<ItemImageGalleryEntry[]> {
  requireStaffOrOwnerCaller(caller);
  const input = setPrimaryItemImageSchema.parse(rawInput);

  return db.transaction(async (tx) => {
    const before = await getGalleryRows(tx, itemId);
    const target = before.find((r) => r.id === input.itemImageId);
    if (!target) throw new NotFoundError("item_image", input.itemImageId);

    await withAudit(
      tx,
      {
        actor: caller.actor,
        surface: caller.surface,
        action: "set_primary_item_image",
        entityType: "item_image",
        entityId: itemId,
        before,
      },
      async () => {
        await tx
          .update(itemImages)
          .set({ isPrimary: false })
          .where(and(eq(itemImages.itemId, itemId), eq(itemImages.isPrimary, true)));
        await tx.update(itemImages).set({ isPrimary: true }).where(eq(itemImages.id, input.itemImageId));
        const after = await getGalleryRows(tx, itemId);
        return { result: after, after };
      },
    );

    await syncItemHeroImage(tx, itemId);
    await bumpAffectedScreens(tx, { itemIds: [itemId] });
    return getGalleryEntries(tx, itemId);
  });
}

// --- Revert registration ----------------------------------------------
//
// `before` is always this item's full ordered gallery array as of just
// before the mutation (possibly `[]` — there is no "create" shape here the
// way items.ts's `before === null` means "delete on revert": an item_image
// entity_id is always an item id, whose gallery may legitimately be empty).
// Revert replaces current membership with `before` verbatim (id/sortOrder/
// isPrimary included), then re-syncs `items.imageId`.
registerRevertHandler("item_image", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("item_image revert requires an entity_id");
  const itemId = ctx.entityId;
  const beforeRows = ((ctx.before ?? []) as ItemImage[]).map((row) => reviveDates(row, ["createdAt"]));

  await db.delete(itemImages).where(eq(itemImages.itemId, itemId));
  if (beforeRows.length > 0) {
    await db.insert(itemImages).values(beforeRows);
  }

  await syncItemHeroImage(db, itemId);
  // `revertChange`/`revertBulkGroup` (src/lib/service/revert.ts) only bump
  // affected screens for entity_type "item"/"category"/"tag" — do it here so
  // reverting a gallery change still propagates to any screen (and /menu)
  // referencing this item's hero image.
  await bumpAffectedScreens(db, { itemIds: [itemId] });
});
