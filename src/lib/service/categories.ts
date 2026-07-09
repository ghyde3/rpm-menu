// Categories CRUD (PRD §5.1, addendum §2's `tagline` addition).
import { eq } from "drizzle-orm";
import { categories, items, type Category } from "@/db/schema";
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
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/lib/validation/categories";

async function getCategoryOrThrow(db: DbClient, categoryId: string): Promise<Category> {
  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!category) throw new NotFoundError("category", categoryId);
  return category;
}

export async function listCategories(db: DbClient): Promise<Category[]> {
  return db.select().from(categories);
}

export async function getCategory(db: DbClient, categoryId: string): Promise<Category> {
  return getCategoryOrThrow(db, categoryId);
}

export async function createCategory(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateCategoryInput,
): Promise<Category> {
  requireStaffOrOwnerCaller(caller);
  const input = createCategorySchema.parse(rawInput);

  const created = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_category",
      entityType: "category",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db.insert(categories).values(input).returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, { categoryIds: [created.id] });
  return created;
}

export async function updateCategory(
  db: DbClient,
  caller: ServiceCaller,
  categoryId: string,
  rawInput: UpdateCategoryInput,
): Promise<Category> {
  requireStaffOrOwnerCaller(caller);
  const input = updateCategorySchema.parse(rawInput);
  const before = await getCategoryOrThrow(db, categoryId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_category",
      entityType: "category",
      entityId: categoryId,
      before,
    },
    async () => {
      const [after] = await db
        .update(categories)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(categories.id, categoryId))
        .returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, { categoryIds: [categoryId] });
  return updated;
}

/**
 * Deletes a category. Refuses (ConflictError) if any item still references
 * it — `items.category_id` is `ON DELETE RESTRICT`, so this check exists to
 * turn a raw FK-violation 500 into an actionable 409 before the DB ever
 * rejects the statement.
 */
export async function deleteCategory(db: DbClient, caller: ServiceCaller, categoryId: string): Promise<void> {
  requireStaffOrOwnerCaller(caller);
  const before = await getCategoryOrThrow(db, categoryId);

  const [itemInCategory] = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.categoryId, categoryId))
    .limit(1);
  if (itemInCategory) {
    throw new ConflictError(
      `Cannot delete category "${before.name}" while it still has items — move or delete them first.`,
    );
  }

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_category",
      entityType: "category",
      entityId: categoryId,
      before,
    },
    async () => {
      await db.delete(categories).where(eq(categories.id, categoryId));
      return { result: undefined, after: null };
    },
  );

  await bumpAffectedScreens(db, { categoryIds: [categoryId] });
}

registerRevertHandler("category", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("category revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(categories).where(eq(categories.id, ctx.entityId));
    return;
  }
  const beforeRow = reviveDates(ctx.before as Category, ["createdAt", "updatedAt"]);
  const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(categories).values(beforeRow);
  } else {
    await db.update(categories).set(beforeRow).where(eq(categories.id, ctx.entityId));
  }
});
