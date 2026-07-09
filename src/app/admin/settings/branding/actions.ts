"use server";

// Thin server-action wrappers over src/lib/service/settings/branding.ts — no
// logic lives here beyond building a ServiceCaller from the current session
// and shaping the result for the client component (per docs/architecture.md:
// "route handlers ... are thin wrappers around these [service functions] —
// never parallel logic").
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import type { ServiceCaller } from "@/lib/service/base";
import {
  getBrandingSettings,
  updateBranding,
  type BrandingSettings,
  type UpdateBrandingInput,
} from "@/lib/service/settings/branding";

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

export async function getBrandingSettingsAction(): Promise<ActionResult<BrandingSettings>> {
  return toResult(() => getBrandingSettings(db));
}

export async function updateBrandingAction(
  input: UpdateBrandingInput,
): Promise<ActionResult<BrandingSettings>> {
  const caller = await callerFromSession();
  const result = await toResult(() => updateBranding(db, caller, input));
  if (result.ok) {
    revalidatePath("/admin/settings/branding");
  }
  return result;
}
