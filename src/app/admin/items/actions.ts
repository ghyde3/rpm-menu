"use server";

// Thin server-action wrappers over src/lib/service/items.ts (docs/
// architecture.md: "Admin UI route handlers ... are thin wrappers around
// these — never parallel logic"). Every function here does exactly three
// things: build a ServiceCaller from the current session, call the service
// function, and translate the result/error into a plain object the client
// components in this directory can render without importing service/auth
// internals.
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import {
  createItem,
  updateItem,
  deleteItem,
  setItemAvailability,
  setItemTags,
  setFeaturedSlot,
  clearFeaturedSlot,
  createItemPriceVariant,
  updateItemPriceVariant,
  deleteItemPriceVariant,
} from "@/lib/service/items";
import type {
  CreateItemInput,
  UpdateItemInput,
  CreateItemPriceVariantInput,
  UpdateItemPriceVariantInput,
} from "@/lib/validation/items";

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

function revalidateItems() {
  revalidatePath("/admin/items");
  revalidatePath("/admin/items/bulk");
}

export async function createItemAction(input: CreateItemInput): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createItem(db, caller, input);
    revalidateItems();
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateItemAction(itemId: string, input: UpdateItemInput): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await updateItem(db, caller, itemId, input);
    revalidateItems();
    revalidatePath(`/admin/items/${itemId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteItemAction(itemId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteItem(db, caller, itemId);
    revalidateItems();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** The one-tap 86 toggle (§3.1 goal: never more than two taps from opening
 * the admin on a phone — this is the single network call the mobile Switch
 * fires). */
export async function setItemAvailabilityAction(itemId: string, isAvailable: boolean): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await setItemAvailability(db, caller, itemId, { isAvailable });
    revalidateItems();
    revalidatePath(`/admin/items/${itemId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function setItemTagsAction(itemId: string, tagIds: string[]): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await setItemTags(db, caller, itemId, { tagIds });
    revalidateItems();
    revalidatePath(`/admin/items/${itemId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function setFeaturedSlotAction(itemId: string, featuredSlotKey: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await setFeaturedSlot(db, caller, itemId, { featuredSlotKey });
    revalidateItems();
    revalidatePath(`/admin/items/${itemId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function clearFeaturedSlotAction(itemId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await clearFeaturedSlot(db, caller, itemId);
    revalidateItems();
    revalidatePath(`/admin/items/${itemId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createItemPriceVariantAction(
  input: CreateItemPriceVariantInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createItemPriceVariant(db, caller, input);
    revalidatePath(`/admin/items/${input.itemId}`);
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateItemPriceVariantAction(
  variantId: string,
  itemId: string,
  input: UpdateItemPriceVariantInput,
): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await updateItemPriceVariant(db, caller, variantId, input);
    revalidatePath(`/admin/items/${itemId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteItemPriceVariantAction(variantId: string, itemId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteItemPriceVariant(db, caller, variantId);
    revalidatePath(`/admin/items/${itemId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
