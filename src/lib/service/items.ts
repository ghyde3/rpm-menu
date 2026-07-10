// Items CRUD + availability toggle + featured-slot swap (PRD §5.1, addendum
// §2). Every mutation: Zod-validate -> role-check -> write -> withAudit ->
// bumpAffectedScreens, per docs/architecture.md's "Service layer" contract.
import { and, eq } from "drizzle-orm";
import {
  items,
  itemTags,
  itemPriceVariants,
  type Item,
  type ItemPriceVariant,
} from "@/db/schema";
import {
  registerRevertHandler,
  requireStaffOrOwnerCaller,
  requireOwnerCaller,
  withAudit,
  bumpAffectedScreens,
  reviveDates,
  type DbClient,
  type ServiceCaller,
} from "./base";
import { NotFoundError, ConflictError } from "./base/errors";
import {
  createItemSchema,
  updateItemSchema,
  setItemAvailabilitySchema,
  setItemTagsSchema,
  setFeaturedSlotSchema,
  createItemPriceVariantSchema,
  updateItemPriceVariantSchema,
  type CreateItemInput,
  type UpdateItemInput,
  type SetItemAvailabilityInput,
  type SetItemTagsInput,
  type SetFeaturedSlotInput,
  type CreateItemPriceVariantInput,
  type UpdateItemPriceVariantInput,
} from "@/lib/validation/items";

async function getItemOrThrow(db: DbClient, itemId: string): Promise<Item> {
  const [item] = await db.select().from(items).where(eq(items.id, itemId));
  if (!item) throw new NotFoundError("item", itemId);
  return item;
}

export async function getItemTagIds(db: DbClient, itemId: string): Promise<string[]> {
  const rows = await db.select({ tagId: itemTags.tagId }).from(itemTags).where(eq(itemTags.itemId, itemId));
  return rows.map((r) => r.tagId);
}

export async function listItems(db: DbClient): Promise<Item[]> {
  return db.select().from(items);
}

export async function getItem(db: DbClient, itemId: string): Promise<Item> {
  return getItemOrThrow(db, itemId);
}

/** A price-bearing field only an owner may set (PRD §2: staff "cannot change
 * prices"). Checked against the *raw* (pre-Zod-default) input — the parsed
 * schema always fills `pricingType` via `.default("fixed")`, which would
 * otherwise make this look "touched" on every call. */
function touchesPriceFields(rawInput: { priceCents?: number | null; pricingType?: string }): boolean {
  return rawInput.priceCents !== undefined || rawInput.pricingType !== undefined;
}

export async function createItem(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateItemInput,
): Promise<Item> {
  // §2: staff cannot set a price at creation time either — only owners may
  // put a dollar figure (or pricing classification) on an item.
  if (touchesPriceFields(rawInput)) {
    requireOwnerCaller(caller);
  } else {
    requireStaffOrOwnerCaller(caller);
  }
  const input = createItemSchema.parse(rawInput);

  const created = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_item",
      entityType: "item",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db.insert(items).values(input).returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, { itemIds: [created.id], categoryIds: [created.categoryId] });
  return created;
}

export async function updateItem(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: UpdateItemInput,
): Promise<Item> {
  // §2: staff can edit descriptions/name/category/tags/etc. but not prices —
  // only escalate to owner-only when the update actually touches a price
  // field, so the common staff edits (fix a typo, re-sort) still work.
  if (touchesPriceFields(rawInput)) {
    requireOwnerCaller(caller);
  } else {
    requireStaffOrOwnerCaller(caller);
  }
  const input = updateItemSchema.parse(rawInput);
  const before = await getItemOrThrow(db, itemId);
  const beforeTagIds = await getItemTagIds(db, itemId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_item",
      entityType: "item",
      entityId: itemId,
      before,
    },
    async () => {
      const [after] = await db
        .update(items)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(items.id, itemId))
        .returning();
      return { result: after, after };
    },
  );

  const categoryIds = Array.from(new Set([before.categoryId, updated.categoryId]));
  await bumpAffectedScreens(db, { itemIds: [itemId], categoryIds, tagIds: beforeTagIds });
  return updated;
}

export async function deleteItem(db: DbClient, caller: ServiceCaller, itemId: string): Promise<void> {
  // §2: staff explicitly "cannot ... delete items" — owner only.
  requireOwnerCaller(caller);
  const before = await getItemOrThrow(db, itemId);
  const tagIds = await getItemTagIds(db, itemId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_item",
      entityType: "item",
      entityId: itemId,
      before,
    },
    async () => {
      await db.delete(items).where(eq(items.id, itemId));
      return { result: undefined, after: null };
    },
  );

  await bumpAffectedScreens(db, { itemIds: [itemId], categoryIds: [before.categoryId], tagIds });
}

/** The "86 it" toggle (§6 success metric: time-to-86 < 10s) — a thin,
 * single-purpose wrapper over `updateItem`'s write path so the common case
 * has a minimal, unambiguous call site. */
export async function setItemAvailability(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: SetItemAvailabilityInput,
): Promise<Item> {
  requireStaffOrOwnerCaller(caller);
  const input = setItemAvailabilitySchema.parse(rawInput);
  const before = await getItemOrThrow(db, itemId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "set_item_availability",
      entityType: "item",
      entityId: itemId,
      before,
    },
    async () => {
      const [after] = await db
        .update(items)
        .set({ isAvailable: input.isAvailable, updatedAt: new Date() })
        .where(eq(items.id, itemId))
        .returning();
      return { result: after, after };
    },
  );

  const tagIds = await getItemTagIds(db, itemId);
  await bumpAffectedScreens(db, { itemIds: [itemId], categoryIds: [before.categoryId], tagIds });
  return updated;
}

/** Replaces an item's full tag set in one call (attach + detach diffed
 * against current membership). Audited under `entity_type = "item"` (there
 * is no standalone `item_tag` entity in the registry — §4.2/addendum §2). */
export async function setItemTags(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: SetItemTagsInput,
): Promise<string[]> {
  requireStaffOrOwnerCaller(caller);
  const input = setItemTagsSchema.parse(rawInput);
  await getItemOrThrow(db, itemId);
  const beforeTagIds = await getItemTagIds(db, itemId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "set_item_tags",
      entityType: "item",
      entityId: itemId,
      before: { tagIds: beforeTagIds },
    },
    async () => {
      await db.delete(itemTags).where(eq(itemTags.itemId, itemId));
      if (input.tagIds.length > 0) {
        await db.insert(itemTags).values(input.tagIds.map((tagId) => ({ itemId, tagId })));
      }
      return { result: input.tagIds, after: { tagIds: input.tagIds } };
    },
  );

  const allTagIds = Array.from(new Set([...beforeTagIds, ...input.tagIds]));
  await bumpAffectedScreens(db, { itemIds: [itemId], tagIds: allTagIds });
  return input.tagIds;
}

/**
 * Reassigns a featured slot (e.g. `drink_of_the_week`) as a single
 * transaction: clears whichever other item currently holds the slot, then
 * sets it on `itemId`. Required by the addendum so the partial-unique-index
 * invariant ("exactly one holder per slot") is never violated by a
 * read-then-write race between two admin tabs.
 */
export async function setFeaturedSlot(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: SetFeaturedSlotInput,
): Promise<Item> {
  requireStaffOrOwnerCaller(caller);
  const input = setFeaturedSlotSchema.parse(rawInput);

  return db.transaction(async (tx) => {
    const before = await getItemOrThrow(tx, itemId);

    const [previousHolder] = await tx
      .select()
      .from(items)
      .where(eq(items.featuredSlotKey, input.featuredSlotKey));

    if (previousHolder && previousHolder.id !== itemId) {
      await tx
        .update(items)
        .set({ featuredSlotKey: null, updatedAt: new Date() })
        .where(eq(items.id, previousHolder.id));
    }

    const updated = await withAudit(
      tx,
      {
        actor: caller.actor,
        surface: caller.surface,
        action: "set_featured_slot",
        entityType: "item",
        entityId: itemId,
        before,
      },
      async () => {
        const [after] = await tx
          .update(items)
          .set({ featuredSlotKey: input.featuredSlotKey, updatedAt: new Date() })
          .where(eq(items.id, itemId))
          .returning();
        return { result: after, after };
      },
    );

    if (previousHolder && previousHolder.id !== itemId) {
      await bumpAffectedScreens(tx, { itemIds: [previousHolder.id, itemId] });
    } else {
      await bumpAffectedScreens(tx, { itemIds: [itemId] });
    }

    return updated;
  });
}

/** Clears `featuredSlotKey` on `itemId` if it currently holds one. No-op
 * (but still audited) if it doesn't. */
export async function clearFeaturedSlot(db: DbClient, caller: ServiceCaller, itemId: string): Promise<Item> {
  requireStaffOrOwnerCaller(caller);
  const before = await getItemOrThrow(db, itemId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "clear_featured_slot",
      entityType: "item",
      entityId: itemId,
      before,
    },
    async () => {
      const [after] = await db
        .update(items)
        .set({ featuredSlotKey: null, updatedAt: new Date() })
        .where(eq(items.id, itemId))
        .returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, { itemIds: [itemId] });
  return updated;
}

// --- Price variants (sizes / happy hour, addendum §2) ---------------------

export async function listItemPriceVariants(db: DbClient, itemId: string): Promise<ItemPriceVariant[]> {
  return db.select().from(itemPriceVariants).where(eq(itemPriceVariants.itemId, itemId));
}

export async function createItemPriceVariant(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateItemPriceVariantInput,
): Promise<ItemPriceVariant> {
  // §2: a price variant is nothing but a price — owner only.
  requireOwnerCaller(caller);
  const input = createItemPriceVariantSchema.parse(rawInput);
  await getItemOrThrow(db, input.itemId);

  // §2 / PriceVariantsEditor's own contract: "at most one kind=happy_hour
  // price variant per item." The UI only ever offers "Set Happy Hour
  // Price" when none exists yet, but that check is client-side state that
  // can go stale (two tabs open on the same item, a slow double-submit).
  // Reject here so the invariant holds even under a race, instead of
  // silently leaving two happy_hour rows for buildPriceInfo's unordered
  // `.find()` to pick between. The DB's partial unique index
  // (item_price_variants_one_happy_hour_per_item) is the ultimate
  // backstop; this check gives a clean ConflictError instead of a raw
  // constraint-violation error surfacing to the caller.
  if (input.kind === "happy_hour") {
    const [existingHappyHour] = await db
      .select()
      .from(itemPriceVariants)
      .where(and(eq(itemPriceVariants.itemId, input.itemId), eq(itemPriceVariants.kind, "happy_hour")));
    if (existingHappyHour) {
      throw new ConflictError("This item already has a happy hour price. Delete it before adding a new one.");
    }
  }

  const [created] = await db.insert(itemPriceVariants).values(input).returning();
  await bumpAffectedScreens(db, { itemIds: [input.itemId] });
  return created;
}

export async function updateItemPriceVariant(
  db: DbClient,
  caller: ServiceCaller,
  variantId: string,
  rawInput: UpdateItemPriceVariantInput,
): Promise<ItemPriceVariant> {
  requireOwnerCaller(caller);
  const input = updateItemPriceVariantSchema.parse(rawInput);
  const [before] = await db.select().from(itemPriceVariants).where(eq(itemPriceVariants.id, variantId));
  if (!before) throw new NotFoundError("item_price_variant", variantId);

  const [updated] = await db
    .update(itemPriceVariants)
    .set(input)
    .where(eq(itemPriceVariants.id, variantId))
    .returning();
  await bumpAffectedScreens(db, { itemIds: [before.itemId] });
  return updated;
}

export async function deleteItemPriceVariant(
  db: DbClient,
  caller: ServiceCaller,
  variantId: string,
): Promise<void> {
  requireOwnerCaller(caller);
  const [before] = await db.select().from(itemPriceVariants).where(eq(itemPriceVariants.id, variantId));
  if (!before) throw new NotFoundError("item_price_variant", variantId);

  await db.delete(itemPriceVariants).where(eq(itemPriceVariants.id, variantId));
  await bumpAffectedScreens(db, { itemIds: [before.itemId] });
}

/** Replaces `itemId`'s full tag membership with `tagIds`, the same
 * delete-all-then-reinsert diff `setItemTags`'s own write uses. Shared by
 * the revert handler below so a `set_item_tags` audit row's `before.tagIds`
 * shape genuinely restores `item_tags` membership on revert, instead of
 * silently no-op'ing. */
async function restoreItemTagMembership(db: DbClient, itemId: string, tagIds: string[]): Promise<void> {
  await db.delete(itemTags).where(eq(itemTags.itemId, itemId));
  if (tagIds.length > 0) {
    await db.insert(itemTags).values(tagIds.map((tagId) => ({ itemId, tagId })));
  }
}

/** Distinguishes a `set_item_tags` audit row's `{ tagIds }` before-shape
 * from a real `items` row snapshot — `items` rows never carry a `tagIds`
 * field (tag membership lives in the separate `item_tags` table). */
function isTagSetShape(value: unknown): value is { tagIds: string[] } {
  return !!value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).tagIds);
}

// --- Revert registration ----------------------------------------------
//
// `before === null` => the audited mutation was a create, so revert deletes
// the row. `before` shaped `{ tagIds }` => the audited mutation was a
// `set_item_tags` call, so revert restores `item_tags` membership instead of
// touching the `items` row. Otherwise upsert the full `before` row back by
// id (covers update/delete/availability/featured-slot item field changes).
registerRevertHandler("item", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("item revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(items).where(eq(items.id, ctx.entityId));
    return;
  }
  if (isTagSetShape(ctx.before)) {
    await restoreItemTagMembership(db, ctx.entityId, ctx.before.tagIds);
    return;
  }
  const beforeRow = reviveDates(ctx.before as Item, ["createdAt", "updatedAt"]);
  const existing = await db.select({ id: items.id }).from(items).where(eq(items.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(items).values(beforeRow);
  } else {
    await db.update(items).set(beforeRow).where(eq(items.id, ctx.entityId));
  }
});

