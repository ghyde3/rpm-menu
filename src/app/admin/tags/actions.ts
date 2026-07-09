"use server";

// Thin server-action wrappers over src/lib/service/tags.ts — see
// src/app/admin/items/actions.ts's header comment for the pattern. Create/
// update/delete are owner-only in the service layer (tag visibility is
// "editable by owner" per PRD §3.1) — a staff caller gets a clean error
// string here rather than an unhandled throw.
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import { createTag, updateTag, deleteTag } from "@/lib/service/tags";
import type { CreateTagInput, UpdateTagInput } from "@/lib/validation/tags";

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

function revalidateTags() {
  revalidatePath("/admin/tags");
  revalidatePath("/admin/items");
  revalidatePath("/admin/items/new");
}

export async function createTagAction(input: CreateTagInput): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createTag(db, caller, input);
    revalidateTags();
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateTagAction(tagId: string, input: UpdateTagInput): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await updateTag(db, caller, tagId, input);
    revalidateTags();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteTagAction(tagId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteTag(db, caller, tagId);
    revalidateTags();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
