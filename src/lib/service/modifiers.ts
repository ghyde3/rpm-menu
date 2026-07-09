// Modifier groups/options/attachments/exclusions CRUD (addendum §1).
import { eq, inArray, or } from "drizzle-orm";
import {
  modifierGroups,
  modifierOptions,
  modifierGroupAttachments,
  itemModifierOptionExclusions,
  items,
  categories,
  type ModifierGroup,
  type ModifierOption,
  type ModifierGroupAttachment,
} from "@/db/schema";
import {
  registerRevertHandler,
  requireStaffOrOwnerCaller,
  withAudit,
  bumpAffectedScreens,
  reviveDates,
  type DbClient,
  type ServiceCaller,
  type AffectedScope,
} from "./base";
import { NotFoundError, ConflictError } from "./base/errors";
import { resolveOptionPrice, type ResolvedOptionPrice } from "@/lib/pricing";
import {
  createModifierGroupSchema,
  updateModifierGroupSchema,
  createModifierOptionSchema,
  updateModifierOptionSchema,
  resolveModifierOptionPricingSchema,
  createModifierGroupAttachmentSchema,
  setItemModifierOptionExclusionsSchema,
  type CreateModifierGroupInput,
  type UpdateModifierGroupInput,
  type CreateModifierOptionInput,
  type UpdateModifierOptionInput,
  type ResolveModifierOptionPricingInput,
  type CreateModifierGroupAttachmentInput,
  type SetItemModifierOptionExclusionsInput,
} from "@/lib/validation/modifiers";

async function getModifierGroupOrThrow(db: DbClient, groupId: string): Promise<ModifierGroup> {
  const [group] = await db.select().from(modifierGroups).where(eq(modifierGroups.id, groupId));
  if (!group) throw new NotFoundError("modifier_group", groupId);
  return group;
}

async function getModifierOptionOrThrow(db: DbClient, optionId: string): Promise<ModifierOption> {
  const [option] = await db.select().from(modifierOptions).where(eq(modifierOptions.id, optionId));
  if (!option) throw new NotFoundError("modifier_option", optionId);
  return option;
}

/** Every item/category a group's options currently render on, so a group- or
 * option-level edit can bump exactly the screens that could show it. */
async function getGroupAffectedScope(db: DbClient, groupId: string): Promise<AffectedScope> {
  const attachments = await db
    .select({ itemId: modifierGroupAttachments.itemId, categoryId: modifierGroupAttachments.categoryId })
    .from(modifierGroupAttachments)
    .where(eq(modifierGroupAttachments.groupId, groupId));
  return {
    itemIds: attachments.map((a) => a.itemId).filter((v): v is string => v !== null),
    categoryIds: attachments.map((a) => a.categoryId).filter((v): v is string => v !== null),
  };
}

// --- Modifier groups --------------------------------------------------

export async function listModifierGroups(db: DbClient): Promise<ModifierGroup[]> {
  return db.select().from(modifierGroups);
}

export async function getModifierGroup(db: DbClient, groupId: string): Promise<ModifierGroup> {
  return getModifierGroupOrThrow(db, groupId);
}

export async function getModifierOption(db: DbClient, optionId: string): Promise<ModifierOption> {
  return getModifierOptionOrThrow(db, optionId);
}

export async function createModifierGroup(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateModifierGroupInput,
): Promise<ModifierGroup> {
  requireStaffOrOwnerCaller(caller);
  const input = createModifierGroupSchema.parse(rawInput);

  return withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_modifier_group",
      entityType: "modifier_group",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db.insert(modifierGroups).values(input).returning();
      return { result: after, after };
    },
  );
}

export async function updateModifierGroup(
  db: DbClient,
  caller: ServiceCaller,
  groupId: string,
  rawInput: UpdateModifierGroupInput,
): Promise<ModifierGroup> {
  requireStaffOrOwnerCaller(caller);
  const input = updateModifierGroupSchema.parse(rawInput);
  const before = await getModifierGroupOrThrow(db, groupId);
  const scope = await getGroupAffectedScope(db, groupId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_modifier_group",
      entityType: "modifier_group",
      entityId: groupId,
      before,
    },
    async () => {
      const [after] = await db
        .update(modifierGroups)
        .set(input)
        .where(eq(modifierGroups.id, groupId))
        .returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, scope);
  return updated;
}

/** Deletes a group. Options/attachments cascade (`ON DELETE CASCADE`). */
export async function deleteModifierGroup(db: DbClient, caller: ServiceCaller, groupId: string): Promise<void> {
  requireStaffOrOwnerCaller(caller);
  const before = await getModifierGroupOrThrow(db, groupId);
  const scope = await getGroupAffectedScope(db, groupId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_modifier_group",
      entityType: "modifier_group",
      entityId: groupId,
      before,
    },
    async () => {
      await db.delete(modifierGroups).where(eq(modifierGroups.id, groupId));
      return { result: undefined, after: null };
    },
  );

  await bumpAffectedScreens(db, scope);
}

// --- Modifier options ---------------------------------------------------

export async function listModifierOptions(db: DbClient, groupId: string): Promise<ModifierOption[]> {
  return db.select().from(modifierOptions).where(eq(modifierOptions.groupId, groupId));
}

/** Creates an option. `pricing_mode` is restricted to `included` |
 * `ambiguous` at creation time (see validation/modifiers.ts) — `delta` /
 * `replacement` are only ever set via `resolveModifierOptionPricing`. */
export async function createModifierOption(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateModifierOptionInput,
): Promise<ModifierOption> {
  requireStaffOrOwnerCaller(caller);
  const input = createModifierOptionSchema.parse(rawInput);
  await getModifierGroupOrThrow(db, input.groupId);

  const created = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_modifier_option",
      entityType: "modifier_option",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db.insert(modifierOptions).values(input).returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, await getGroupAffectedScope(db, input.groupId));
  return created;
}

/** Non-pricing edits (label/link/sort/availability) only — see
 * validation/modifiers.ts's `updateModifierOptionSchema` doc comment. */
export async function updateModifierOption(
  db: DbClient,
  caller: ServiceCaller,
  optionId: string,
  rawInput: UpdateModifierOptionInput,
): Promise<ModifierOption> {
  requireStaffOrOwnerCaller(caller);
  const input = updateModifierOptionSchema.parse(rawInput);
  const before = await getModifierOptionOrThrow(db, optionId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_modifier_option",
      entityType: "modifier_option",
      entityId: optionId,
      before,
    },
    async () => {
      const [after] = await db
        .update(modifierOptions)
        .set(input)
        .where(eq(modifierOptions.id, optionId))
        .returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, await getGroupAffectedScope(db, before.groupId));
  return updated;
}

/**
 * The addendum's two explicit disambiguation buttons: "this is the new
 * total" (`mode: "replacement"`) or "this is added to base" (`mode:
 * "delta"`). This is the ONLY way `price_delta_cents` / `replacement_price_cents`
 * get set on a previously-`ambiguous` option — never a bare field update.
 */
export async function resolveModifierOptionPricing(
  db: DbClient,
  caller: ServiceCaller,
  optionId: string,
  rawInput: ResolveModifierOptionPricingInput,
): Promise<ModifierOption> {
  requireStaffOrOwnerCaller(caller);
  const input = resolveModifierOptionPricingSchema.parse(rawInput);
  const before = await getModifierOptionOrThrow(db, optionId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "resolve_modifier_option_pricing",
      entityType: "modifier_option",
      entityId: optionId,
      before,
    },
    async () => {
      const [after] = await db
        .update(modifierOptions)
        .set(
          input.mode === "delta"
            ? { pricingMode: "delta", priceDeltaCents: input.priceDeltaCents, replacementPriceCents: null }
            : {
                pricingMode: "replacement",
                replacementPriceCents: input.replacementPriceCents,
                priceDeltaCents: null,
              },
        )
        .where(eq(modifierOptions.id, optionId))
        .returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, await getGroupAffectedScope(db, before.groupId));
  return updated;
}

export async function deleteModifierOption(db: DbClient, caller: ServiceCaller, optionId: string): Promise<void> {
  requireStaffOrOwnerCaller(caller);
  const before = await getModifierOptionOrThrow(db, optionId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_modifier_option",
      entityType: "modifier_option",
      entityId: optionId,
      before,
    },
    async () => {
      await db.delete(modifierOptions).where(eq(modifierOptions.id, optionId));
      return { result: undefined, after: null };
    },
  );

  await bumpAffectedScreens(db, await getGroupAffectedScope(db, before.groupId));
}

// --- Group attachments (item XOR category, addendum §1) ------------------

export async function listModifierGroupAttachments(
  db: DbClient,
  groupId: string,
): Promise<ModifierGroupAttachment[]> {
  return db.select().from(modifierGroupAttachments).where(eq(modifierGroupAttachments.groupId, groupId));
}

export async function createModifierGroupAttachment(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateModifierGroupAttachmentInput,
): Promise<ModifierGroupAttachment> {
  requireStaffOrOwnerCaller(caller);
  const input = createModifierGroupAttachmentSchema.parse(rawInput);
  await getModifierGroupOrThrow(db, input.groupId);

  const created = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_modifier_group_attachment",
      entityType: "modifier_group_attachment",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db.insert(modifierGroupAttachments).values(input).returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, {
    itemIds: created.itemId ? [created.itemId] : [],
    categoryIds: created.categoryId ? [created.categoryId] : [],
  });
  return created;
}

export async function deleteModifierGroupAttachment(
  db: DbClient,
  caller: ServiceCaller,
  attachmentId: string,
): Promise<void> {
  requireStaffOrOwnerCaller(caller);
  const [before] = await db
    .select()
    .from(modifierGroupAttachments)
    .where(eq(modifierGroupAttachments.id, attachmentId));
  if (!before) throw new NotFoundError("modifier_group_attachment", attachmentId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_modifier_group_attachment",
      entityType: "modifier_group_attachment",
      entityId: attachmentId,
      before,
    },
    async () => {
      await db.delete(modifierGroupAttachments).where(eq(modifierGroupAttachments.id, attachmentId));
      return { result: undefined, after: null };
    },
  );

  await bumpAffectedScreens(db, {
    itemIds: before.itemId ? [before.itemId] : [],
    categoryIds: before.categoryId ? [before.categoryId] : [],
  });
}

// --- Per-item option exclusions (addendum §1) -----------------------------

/**
 * Replaces the full set of options `itemId` excludes from its inherited
 * (category-level) modifier groups. Audited under `entity_type =
 * "item_modifier_option_exclusion"` with `entity_id = itemId` — the table's
 * primary key is composite (`item_id`, `option_id`), so there is no
 * per-exclusion surrogate id to hang an audit row off of; the item is the
 * natural grouping unit and `before`/`after` carry the full option-id list.
 */
export async function setItemModifierOptionExclusions(
  db: DbClient,
  caller: ServiceCaller,
  itemId: string,
  rawInput: SetItemModifierOptionExclusionsInput,
): Promise<string[]> {
  requireStaffOrOwnerCaller(caller);
  const input = setItemModifierOptionExclusionsSchema.parse(rawInput);

  const beforeRows = await db
    .select({ optionId: itemModifierOptionExclusions.optionId })
    .from(itemModifierOptionExclusions)
    .where(eq(itemModifierOptionExclusions.itemId, itemId));
  const beforeOptionIds = beforeRows.map((r) => r.optionId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "set_item_modifier_option_exclusions",
      entityType: "item_modifier_option_exclusion",
      entityId: itemId,
      before: { optionIds: beforeOptionIds },
    },
    async () => {
      await db.delete(itemModifierOptionExclusions).where(eq(itemModifierOptionExclusions.itemId, itemId));
      if (input.optionIds.length > 0) {
        await db
          .insert(itemModifierOptionExclusions)
          .values(input.optionIds.map((optionId) => ({ itemId, optionId })));
      }
      return { result: input.optionIds, after: { optionIds: input.optionIds } };
    },
  );

  await bumpAffectedScreens(db, { itemIds: [itemId] });
  return input.optionIds;
}

// --- Composed read views for the admin UI ---------------------------------
//
// Everything below is read-only (no audit/bump — nothing is mutated) and
// exists to compose modifier_groups/modifier_options/modifier_group_
// attachments/item_modifier_option_exclusions with the `items`/`categories`
// tables so the admin pages don't reimplement this joining logic client-side
// or in route handlers. Reading foundation-owned tables here is the same
// pattern `bumpAffectedScreens` already uses cross-domain.

export interface ModifierGroupSummary extends ModifierGroup {
  optionCount: number;
  attachmentCount: number;
}

/** Library listing for /admin/modifiers — every group plus cheap counts, no
 * N+1 (batched by groupId across the whole set). */
export async function listModifierGroupsWithSummary(db: DbClient): Promise<ModifierGroupSummary[]> {
  const groups = await db.select().from(modifierGroups).orderBy(modifierGroups.sortOrder);
  if (groups.length === 0) return [];
  const groupIds = groups.map((g) => g.id);

  const [optionRows, attachmentRows] = await Promise.all([
    db.select({ groupId: modifierOptions.groupId }).from(modifierOptions).where(inArray(modifierOptions.groupId, groupIds)),
    db
      .select({ groupId: modifierGroupAttachments.groupId })
      .from(modifierGroupAttachments)
      .where(inArray(modifierGroupAttachments.groupId, groupIds)),
  ]);

  const optionCounts = new Map<string, number>();
  for (const row of optionRows) optionCounts.set(row.groupId, (optionCounts.get(row.groupId) ?? 0) + 1);
  const attachmentCounts = new Map<string, number>();
  for (const row of attachmentRows) attachmentCounts.set(row.groupId, (attachmentCounts.get(row.groupId) ?? 0) + 1);

  return groups.map((group) => ({
    ...group,
    optionCount: optionCounts.get(group.id) ?? 0,
    attachmentCount: attachmentCounts.get(group.id) ?? 0,
  }));
}

export interface ModifierGroupAttachmentDetail extends ModifierGroupAttachment {
  itemName: string | null;
  categoryName: string | null;
}

export interface ModifierGroupDetail {
  group: ModifierGroup;
  options: ModifierOption[];
  attachments: ModifierGroupAttachmentDetail[];
}

/** Everything the group edit page (/admin/modifiers/[groupId]) needs in one
 * call: the group row, its options (sorted), and its attachments resolved to
 * human-readable item/category names. */
export async function getModifierGroupDetail(db: DbClient, groupId: string): Promise<ModifierGroupDetail> {
  const group = await getModifierGroupOrThrow(db, groupId);

  const [options, attachments] = await Promise.all([
    db.select().from(modifierOptions).where(eq(modifierOptions.groupId, groupId)).orderBy(modifierOptions.sortOrder),
    db
      .select()
      .from(modifierGroupAttachments)
      .where(eq(modifierGroupAttachments.groupId, groupId))
      .orderBy(modifierGroupAttachments.sortOrder),
  ]);

  const itemIds = attachments.map((a) => a.itemId).filter((v): v is string => v !== null);
  const categoryIds = attachments.map((a) => a.categoryId).filter((v): v is string => v !== null);

  const [itemRows, categoryRows] = await Promise.all([
    itemIds.length > 0
      ? db.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, itemIds))
      : Promise.resolve([] as { id: string; name: string }[]),
    categoryIds.length > 0
      ? db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, categoryIds))
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  const itemNames = new Map(itemRows.map((r) => [r.id, r.name]));
  const categoryNames = new Map(categoryRows.map((r) => [r.id, r.name]));

  return {
    group,
    options,
    attachments: attachments.map((a) => ({
      ...a,
      itemName: a.itemId ? (itemNames.get(a.itemId) ?? null) : null,
      categoryName: a.categoryId ? (categoryNames.get(a.categoryId) ?? null) : null,
    })),
  };
}

export interface CategoryAttachmentPreview {
  count: number;
  sampleItems: { id: string; name: string }[];
}

/** The addendum's "applies to N items" live preview — computed from the
 * category's current membership regardless of whether the attachment has
 * been saved yet, so the admin UI can show this before the save button is
 * even pressed. */
export async function previewCategoryAttachment(db: DbClient, categoryId: string): Promise<CategoryAttachmentPreview> {
  const rows = await db
    .select({ id: items.id, name: items.name })
    .from(items)
    .where(eq(items.categoryId, categoryId))
    .orderBy(items.sortOrder, items.name);
  return { count: rows.length, sampleItems: rows.slice(0, 5) };
}

export interface ItemModifierOptionView {
  option: ModifierOption;
  /** True only for options on an inherited (category-sourced) group that
   * this item has explicitly excluded — addendum §1's per-item exclusion. */
  excluded: boolean;
  resolvedPrice: ResolvedOptionPrice;
}

export interface ItemModifierGroupView {
  group: ModifierGroup;
  /** "item" = attached directly to this item; "category" = inherited via
   * the item's category. */
  source: "item" | "category";
  attachmentId: string;
  options: ItemModifierOptionView[];
}

export interface ItemModifierView {
  itemId: string;
  categoryId: string;
  groups: ItemModifierGroupView[];
}

/** Everything /admin/items/[id]/modifiers needs: every group that applies to
 * this item (attached directly, or inherited from its category), each
 * group's options resolved through the pricing fail-safe, and which
 * inherited options this item has excluded. */
export async function getItemModifierView(db: DbClient, itemId: string): Promise<ItemModifierView> {
  const [item] = await db.select({ id: items.id, categoryId: items.categoryId }).from(items).where(eq(items.id, itemId));
  if (!item) throw new NotFoundError("item", itemId);

  const attachments = await db
    .select()
    .from(modifierGroupAttachments)
    .where(or(eq(modifierGroupAttachments.itemId, itemId), eq(modifierGroupAttachments.categoryId, item.categoryId)))
    .orderBy(modifierGroupAttachments.sortOrder);

  if (attachments.length === 0) {
    return { itemId: item.id, categoryId: item.categoryId, groups: [] };
  }

  const groupIds = [...new Set(attachments.map((a) => a.groupId))];
  const [groups, options, exclusions] = await Promise.all([
    db.select().from(modifierGroups).where(inArray(modifierGroups.id, groupIds)),
    db
      .select()
      .from(modifierOptions)
      .where(inArray(modifierOptions.groupId, groupIds))
      .orderBy(modifierOptions.sortOrder),
    db
      .select({ optionId: itemModifierOptionExclusions.optionId })
      .from(itemModifierOptionExclusions)
      .where(eq(itemModifierOptionExclusions.itemId, itemId)),
  ]);

  const groupsById = new Map(groups.map((g) => [g.id, g]));
  const optionsByGroup = new Map<string, ModifierOption[]>();
  for (const option of options) {
    const list = optionsByGroup.get(option.groupId) ?? [];
    list.push(option);
    optionsByGroup.set(option.groupId, list);
  }
  const excludedIds = new Set(exclusions.map((e) => e.optionId));

  const groupViews: ItemModifierGroupView[] = [];
  for (const attachment of attachments) {
    const group = groupsById.get(attachment.groupId);
    if (!group) continue;
    const source: "item" | "category" = attachment.itemId === itemId ? "item" : "category";
    const groupOptions = optionsByGroup.get(group.id) ?? [];
    groupViews.push({
      group,
      source,
      attachmentId: attachment.id,
      options: groupOptions.map((option) => ({
        option,
        excluded: source === "category" && excludedIds.has(option.id),
        resolvedPrice: resolveOptionPrice({
          pricingMode: option.pricingMode,
          priceDeltaCents: option.priceDeltaCents,
          replacementPriceCents: option.replacementPriceCents,
        }),
      })),
    });
  }

  return { itemId: item.id, categoryId: item.categoryId, groups: groupViews };
}

export interface PricingReviewEntry {
  option: ModifierOption;
  group: ModifierGroup;
  /** Every item this ambiguous option could currently render on — direct
   * item attachments, plus every item in an attached category. Empty when
   * the option's group isn't attached anywhere yet. */
  affectedItems: { id: string; name: string }[];
}

/** The addendum's "N substitution options need pricing confirmed" dashboard
 * nag (addendum §1's fail-safe rule) — every `pricing_mode = 'ambiguous'`
 * option, plus enough context to link straight into the affected item's
 * Modifiers section. */
export async function listOptionsNeedingPricingReview(db: DbClient): Promise<PricingReviewEntry[]> {
  const ambiguousOptions = await db
    .select()
    .from(modifierOptions)
    .where(eq(modifierOptions.pricingMode, "ambiguous"))
    .orderBy(modifierOptions.sortOrder);
  if (ambiguousOptions.length === 0) return [];

  const groupIds = [...new Set(ambiguousOptions.map((o) => o.groupId))];
  const [groups, attachments] = await Promise.all([
    db.select().from(modifierGroups).where(inArray(modifierGroups.id, groupIds)),
    db.select().from(modifierGroupAttachments).where(inArray(modifierGroupAttachments.groupId, groupIds)),
  ]);
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  const directItemIds = attachments.map((a) => a.itemId).filter((v): v is string => v !== null);
  const categoryIds = attachments.map((a) => a.categoryId).filter((v): v is string => v !== null);

  const [directItemRows, categoryItemRows] = await Promise.all([
    directItemIds.length > 0
      ? db
          .select({ id: items.id, name: items.name })
          .from(items)
          .where(inArray(items.id, directItemIds))
      : Promise.resolve([] as { id: string; name: string }[]),
    categoryIds.length > 0
      ? db
          .select({ id: items.id, name: items.name, categoryId: items.categoryId })
          .from(items)
          .where(inArray(items.categoryId, categoryIds))
      : Promise.resolve([] as { id: string; name: string; categoryId: string }[]),
  ]);
  const directItemNames = new Map(directItemRows.map((r) => [r.id, r.name]));

  const affectedByGroup = new Map<string, Map<string, { id: string; name: string }>>();
  for (const attachment of attachments) {
    const bucket = affectedByGroup.get(attachment.groupId) ?? new Map<string, { id: string; name: string }>();
    if (attachment.itemId) {
      const name = directItemNames.get(attachment.itemId);
      if (name) bucket.set(attachment.itemId, { id: attachment.itemId, name });
    } else if (attachment.categoryId) {
      for (const row of categoryItemRows) {
        if (row.categoryId === attachment.categoryId) bucket.set(row.id, { id: row.id, name: row.name });
      }
    }
    affectedByGroup.set(attachment.groupId, bucket);
  }

  const entries: PricingReviewEntry[] = [];
  for (const option of ambiguousOptions) {
    const group = groupsById.get(option.groupId);
    if (!group) continue;
    const bucket = affectedByGroup.get(option.groupId);
    entries.push({ option, group, affectedItems: bucket ? Array.from(bucket.values()) : [] });
  }
  return entries;
}

// --- Revert registration ------------------------------------------------

registerRevertHandler("modifier_group", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("modifier_group revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(modifierGroups).where(eq(modifierGroups.id, ctx.entityId));
    return;
  }
  const beforeRow = reviveDates(ctx.before as ModifierGroup, ["createdAt"]);
  const existing = await db
    .select({ id: modifierGroups.id })
    .from(modifierGroups)
    .where(eq(modifierGroups.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(modifierGroups).values(beforeRow);
  } else {
    await db.update(modifierGroups).set(beforeRow).where(eq(modifierGroups.id, ctx.entityId));
  }
});

registerRevertHandler("modifier_option", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("modifier_option revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(modifierOptions).where(eq(modifierOptions.id, ctx.entityId));
    return;
  }
  const beforeRow = ctx.before as ModifierOption;
  const existing = await db
    .select({ id: modifierOptions.id })
    .from(modifierOptions)
    .where(eq(modifierOptions.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(modifierOptions).values(beforeRow);
  } else {
    await db.update(modifierOptions).set(beforeRow).where(eq(modifierOptions.id, ctx.entityId));
  }
});

registerRevertHandler("modifier_group_attachment", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("modifier_group_attachment revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(modifierGroupAttachments).where(eq(modifierGroupAttachments.id, ctx.entityId));
    return;
  }
  const beforeRow = ctx.before as ModifierGroupAttachment;
  const existing = await db
    .select({ id: modifierGroupAttachments.id })
    .from(modifierGroupAttachments)
    .where(eq(modifierGroupAttachments.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(modifierGroupAttachments).values(beforeRow);
  } else {
    await db.update(modifierGroupAttachments).set(beforeRow).where(eq(modifierGroupAttachments.id, ctx.entityId));
  }
});

registerRevertHandler("item_modifier_option_exclusion", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("item_modifier_option_exclusion revert requires an entity_id (item id)");
  const itemId = ctx.entityId;
  const beforeOptionIds = ((ctx.before as { optionIds?: string[] } | null)?.optionIds ?? []) as string[];
  await db.delete(itemModifierOptionExclusions).where(eq(itemModifierOptionExclusions.itemId, itemId));
  if (beforeOptionIds.length > 0) {
    await db
      .insert(itemModifierOptionExclusions)
      .values(beforeOptionIds.map((optionId) => ({ itemId, optionId })));
  }
});
