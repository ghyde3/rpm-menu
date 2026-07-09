// Modifier groups/options/attachments/exclusions CRUD (addendum §1).
import { eq } from "drizzle-orm";
import {
  modifierGroups,
  modifierOptions,
  modifierGroupAttachments,
  itemModifierOptionExclusions,
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
