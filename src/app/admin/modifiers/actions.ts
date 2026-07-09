"use server";

// Thin server-action wrappers over src/lib/service/modifiers.ts for the
// Modifier Groups library (/admin/modifiers). Mirrors the pattern in
// src/app/admin/items/actions.ts: build a ServiceCaller, call the service
// function, translate the result/error into a plain object.
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import {
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  createModifierOption,
  deleteModifierOption,
  resolveModifierOptionPricing,
  createModifierGroupAttachment,
  deleteModifierGroupAttachment,
  previewCategoryAttachment,
  type CategoryAttachmentPreview,
} from "@/lib/service/modifiers";
import type {
  CreateModifierGroupInput,
  UpdateModifierGroupInput,
  CreateModifierOptionInput,
  CreateModifierGroupAttachmentInput,
} from "@/lib/validation/modifiers";

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

function revalidateModifiers(groupId?: string) {
  revalidatePath("/admin/modifiers");
  if (groupId) revalidatePath(`/admin/modifiers/${groupId}`);
}

export async function createModifierGroupAction(
  input: CreateModifierGroupInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createModifierGroup(db, caller, input);
    revalidateModifiers();
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateModifierGroupAction(
  groupId: string,
  input: UpdateModifierGroupInput,
): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await updateModifierGroup(db, caller, groupId, input);
    revalidateModifiers(groupId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteModifierGroupAction(groupId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteModifierGroup(db, caller, groupId);
    revalidateModifiers();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createModifierOptionAction(
  input: CreateModifierOptionInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createModifierOption(db, caller, input);
    revalidateModifiers(input.groupId);
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteModifierOptionAction(optionId: string, groupId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteModifierOption(db, caller, optionId);
    revalidateModifiers(groupId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** The addendum's two explicit buttons, collapsed to one dollar amount +
 * mode from the UI — see PricingResolver.tsx. */
export async function resolveModifierOptionPricingAction(
  optionId: string,
  groupId: string,
  input: { mode: "delta" | "replacement"; cents: number },
): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    const payload =
      input.mode === "delta"
        ? ({ mode: "delta", priceDeltaCents: input.cents } as const)
        : ({ mode: "replacement", replacementPriceCents: input.cents } as const);
    await resolveModifierOptionPricing(db, caller, optionId, payload);
    revalidateModifiers(groupId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createModifierGroupAttachmentAction(
  input: CreateModifierGroupAttachmentInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createModifierGroupAttachment(db, caller, input);
    revalidateModifiers(input.groupId);
    if (input.itemId) revalidatePath(`/admin/items/${input.itemId}/modifiers`);
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteModifierGroupAttachmentAction(
  attachmentId: string,
  groupId: string,
  itemId?: string | null,
): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteModifierGroupAttachment(db, caller, attachmentId);
    revalidateModifiers(groupId);
    if (itemId) revalidatePath(`/admin/items/${itemId}/modifiers`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** The addendum's "applies to N items" live preview — read-only, no audit
 * (nothing is mutated), so this just proxies the service function. */
export async function previewCategoryAttachmentAction(
  categoryId: string,
): Promise<ActionResult<CategoryAttachmentPreview>> {
  try {
    const preview = await previewCategoryAttachment(db, categoryId);
    return { ok: true, data: preview };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
