"use server";

// Thin server-action wrappers over src/lib/service/modifiers.ts for the
// per-item Modifiers section (/admin/items/[id]/modifiers). Mirrors
// src/app/admin/items/actions.ts's pattern.
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import {
  createModifierGroupAttachment,
  deleteModifierGroupAttachment,
  setItemModifierOptionExclusions,
  resolveModifierOptionPricing,
} from "@/lib/service/modifiers";

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

function revalidateItemModifiers(itemId: string) {
  revalidatePath(`/admin/items/${itemId}/modifiers`);
  revalidatePath("/admin/modifiers");
}

/** Attaches an existing group directly to this item (as opposed to
 * inheriting it via the item's category — addendum §1). */
export async function attachModifierGroupToItemAction(
  itemId: string,
  groupId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createModifierGroupAttachment(db, caller, { groupId, itemId, categoryId: null, sortOrder: 0 });
    revalidateItemModifiers(itemId);
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function detachModifierGroupFromItemAction(attachmentId: string, itemId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteModifierGroupAttachment(db, caller, attachmentId);
    revalidateItemModifiers(itemId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Replaces the full set of options this item excludes from its inherited
 * (category-level) groups — addendum §1's per-item exclusion chips. */
export async function setItemModifierOptionExclusionsAction(
  itemId: string,
  optionIds: string[],
): Promise<ActionResult<string[]>> {
  try {
    const caller = await currentCaller();
    const result = await setItemModifierOptionExclusions(db, caller, itemId, { optionIds });
    revalidateItemModifiers(itemId);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function resolveModifierOptionPricingFromItemAction(
  optionId: string,
  itemId: string,
  input: { mode: "delta" | "replacement"; cents: number },
): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    const payload =
      input.mode === "delta"
        ? ({ mode: "delta", priceDeltaCents: input.cents } as const)
        : ({ mode: "replacement", replacementPriceCents: input.cents } as const);
    await resolveModifierOptionPricing(db, caller, optionId, payload);
    revalidateItemModifiers(itemId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
