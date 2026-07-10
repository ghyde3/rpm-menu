"use server";

// Thin server-action wrappers over src/lib/service/settings/api-keys.ts --
// mirrors src/app/admin/settings/users/actions.ts's shape (build a
// ServiceCaller from the session, call the service, revalidate).
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import type { ServiceCaller } from "@/lib/service/base";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type SafeApiKey,
  type CreateApiKeyInput,
  type CreateApiKeyResult,
} from "@/lib/service/settings/api-keys";

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

export async function listApiKeysAction(): Promise<ActionResult<SafeApiKey[]>> {
  return toResult(async () => {
    const caller = await callerFromSession();
    return listApiKeys(db, caller);
  });
}

export async function createApiKeyAction(
  input: CreateApiKeyInput,
): Promise<ActionResult<CreateApiKeyResult>> {
  const caller = await callerFromSession();
  const result = await toResult(() => createApiKey(db, caller, input));
  if (result.ok) revalidatePath("/admin/settings/api-keys");
  return result;
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult<SafeApiKey>> {
  const caller = await callerFromSession();
  const result = await toResult(() => revokeApiKey(db, caller, id));
  if (result.ok) revalidatePath("/admin/settings/api-keys");
  return result;
}
