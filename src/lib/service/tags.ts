// Tags CRUD (PRD §5.1).
import { eq } from "drizzle-orm";
import { tags, itemTags, type Tag } from "@/db/schema";
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
import { createTagSchema, updateTagSchema, type CreateTagInput, type UpdateTagInput } from "@/lib/validation/tags";

async function getTagOrThrow(db: DbClient, tagId: string): Promise<Tag> {
  const [tag] = await db.select().from(tags).where(eq(tags.id, tagId));
  if (!tag) throw new NotFoundError("tag", tagId);
  return tag;
}

export async function listTags(db: DbClient): Promise<Tag[]> {
  return db.select().from(tags);
}

export async function getTag(db: DbClient, tagId: string): Promise<Tag> {
  return getTagOrThrow(db, tagId);
}

export async function createTag(db: DbClient, caller: ServiceCaller, rawInput: CreateTagInput): Promise<Tag> {
  requireStaffOrOwnerCaller(caller);
  const input = createTagSchema.parse(rawInput);

  return withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_tag",
      entityType: "tag",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db.insert(tags).values(input).returning();
      return { result: after, after };
    },
  );
}

export async function updateTag(
  db: DbClient,
  caller: ServiceCaller,
  tagId: string,
  rawInput: UpdateTagInput,
): Promise<Tag> {
  requireStaffOrOwnerCaller(caller);
  const input = updateTagSchema.parse(rawInput);
  const before = await getTagOrThrow(db, tagId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_tag",
      entityType: "tag",
      entityId: tagId,
      before,
    },
    async () => {
      const [after] = await db.update(tags).set(input).where(eq(tags.id, tagId)).returning();
      return { result: after, after };
    },
  );

  // A tag's visibility/icon/color can change what a public menu badge looks
  // like, and query-mode screens can filter by tag — bump anything keyed to
  // it either way.
  await bumpAffectedScreens(db, { tagIds: [tagId] });
  return updated;
}

/** Deletes a tag. `item_tags` rows cascade (`ON DELETE CASCADE`); every item
 * that carried this tag is bumped so query-mode screens filtering on it
 * re-evaluate promptly. */
export async function deleteTag(db: DbClient, caller: ServiceCaller, tagId: string): Promise<void> {
  requireStaffOrOwnerCaller(caller);
  const before = await getTagOrThrow(db, tagId);
  const taggedItemRows = await db.select({ itemId: itemTags.itemId }).from(itemTags).where(eq(itemTags.tagId, tagId));

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_tag",
      entityType: "tag",
      entityId: tagId,
      before,
    },
    async () => {
      await db.delete(tags).where(eq(tags.id, tagId));
      return { result: undefined, after: null };
    },
  );

  await bumpAffectedScreens(db, {
    tagIds: [tagId],
    itemIds: taggedItemRows.map((r) => r.itemId),
  });
}

registerRevertHandler("tag", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("tag revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(tags).where(eq(tags.id, ctx.entityId));
    return;
  }
  const beforeRow = reviveDates(ctx.before as Tag, ["createdAt"]);
  const existing = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(tags).values(beforeRow);
  } else {
    await db.update(tags).set(beforeRow).where(eq(tags.id, ctx.entityId));
  }
});
