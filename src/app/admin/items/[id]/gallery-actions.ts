"use server";

// Thin server-action wrappers over src/lib/service/item-images.ts — same
// three-step contract as ../actions.ts (build a ServiceCaller from the
// current session, call the service, translate result/error into a plain
// object ItemGallery.tsx can render). Kept as its own co-located file
// (rather than added to ../actions.ts) since this unit owns only files
// under src/app/admin/items/[id]/.
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import {
  addItemImage,
  removeItemImage,
  reorderItemImages,
  setPrimaryItemImage,
  type ItemImageGalleryEntry,
} from "@/lib/service/item-images";

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

function revalidateItem(itemId: string) {
  revalidatePath(`/admin/items/${itemId}`);
  revalidatePath("/admin/items");
}

export async function addItemImageAction(
  itemId: string,
  imageId: string,
): Promise<ActionResult<ItemImageGalleryEntry[]>> {
  try {
    const caller = await currentCaller();
    const gallery = await addItemImage(db, caller, itemId, { imageId });
    revalidateItem(itemId);
    return { ok: true, data: gallery };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function removeItemImageAction(
  itemId: string,
  itemImageId: string,
): Promise<ActionResult<ItemImageGalleryEntry[]>> {
  try {
    const caller = await currentCaller();
    const gallery = await removeItemImage(db, caller, itemId, { itemImageId });
    revalidateItem(itemId);
    return { ok: true, data: gallery };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function reorderItemImagesAction(
  itemId: string,
  orderedItemImageIds: string[],
): Promise<ActionResult<ItemImageGalleryEntry[]>> {
  try {
    const caller = await currentCaller();
    const gallery = await reorderItemImages(db, caller, itemId, { orderedItemImageIds });
    revalidateItem(itemId);
    return { ok: true, data: gallery };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function setPrimaryItemImageAction(
  itemId: string,
  itemImageId: string,
): Promise<ActionResult<ItemImageGalleryEntry[]>> {
  try {
    const caller = await currentCaller();
    const gallery = await setPrimaryItemImage(db, caller, itemId, { itemImageId });
    revalidateItem(itemId);
    return { ok: true, data: gallery };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
