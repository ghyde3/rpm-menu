"use server";

// Thin server-action wrappers over src/lib/service/screens.ts (docs/
// architecture.md: "Admin UI route handlers ... are thin wrappers around
// these — never parallel logic"). Mirrors src/app/admin/items/actions.ts's
// shape: build a ServiceCaller from the session, call the service function,
// translate result/error into a plain object for client components.
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import { createScreen, updateScreen, deleteScreen, setScreenItems } from "@/lib/service/screens";
import type { CreateScreenInput, UpdateScreenInput } from "@/lib/validation/screens";

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

function revalidateScreens(screenId?: string) {
  revalidatePath("/admin/displays/screens");
  if (screenId) revalidatePath(`/admin/displays/screens/${screenId}`);
}

export async function createScreenAction(input: CreateScreenInput): Promise<ActionResult<{ id: string }>> {
  try {
    const caller = await currentCaller();
    const created = await createScreen(db, caller, input);
    revalidateScreens();
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateScreenAction(screenId: string, input: UpdateScreenInput): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await updateScreen(db, caller, screenId, input);
    revalidateScreens(screenId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteScreenAction(screenId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteScreen(db, caller, screenId);
    revalidateScreens();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function setScreenItemsAction(screenId: string, itemIds: string[]): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await setScreenItems(db, caller, screenId, { itemIds });
    revalidateScreens(screenId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
