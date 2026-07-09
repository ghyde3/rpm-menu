"use server";

// Thin server-action wrappers over src/lib/service/categories.ts — see
// src/app/admin/items/actions.ts's header comment for the pattern.
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import { createCategory, updateCategory, deleteCategory } from "@/lib/service/categories";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/validation/categories";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function currentCaller(): Promise<ServiceCaller> {
  const session = await getCurrentSession();
  if (!session) throw new AuthError("Authentication required", 401);
  return {
    actor: { type: "user", id: session.user.id },
    surface: "admin_ui",
    role: session.user.role,
    isActive: session.user.isActive,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof ZodError) return err.issues.map((i) => i.message).join("; ");
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/items");
  revalidatePath("/admin/items/new");
}

export async function createCategoryAction(
  input: CreateCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createCategory(db, caller, input);
    revalidateCategories();
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await updateCategory(db, caller, categoryId, input);
    revalidateCategories();
    revalidatePath(`/admin/categories/${categoryId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteCategory(db, caller, categoryId);
    revalidateCategories();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
