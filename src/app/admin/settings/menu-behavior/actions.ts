"use server";

// Thin server-action wrappers over
// src/lib/service/settings/menu-behavior.ts — no logic lives here beyond
// building a ServiceCaller from the current session and shaping the result
// for the client component (per docs/architecture.md: "route handlers ...
// are thin wrappers around these [service functions] — never parallel
// logic").
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import type { ServiceCaller } from "@/lib/service/base";
import {
  getMenuBehaviorSettings,
  updateMenuBehavior,
  type ResolvedMenuBehavior,
  type UpdateMenuBehaviorInput,
} from "@/lib/service/settings/menu-behavior";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function callerFromSession(): Promise<ServiceCaller> {
  const session = await getCurrentSession();
  return {
    actor: { type: "user", id: session?.user.id ?? null },
    surface: "admin_ui",
    role: session?.user.role,
    isActive: session?.user.isActive,
  };
}

async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function getMenuBehaviorSettingsAction(): Promise<ActionResult<ResolvedMenuBehavior>> {
  return toResult(() => getMenuBehaviorSettings(db));
}

export async function updateMenuBehaviorAction(
  input: UpdateMenuBehaviorInput,
): Promise<ActionResult<ResolvedMenuBehavior>> {
  const caller = await callerFromSession();
  const result = await toResult(() => updateMenuBehavior(db, caller, input));
  if (result.ok) {
    revalidatePath("/admin/settings/menu-behavior");
  }
  return result;
}
