"use server";

// Thin server-action wrappers over src/lib/service/users.ts — no logic here
// beyond building a ServiceCaller from the current session and shaping
// results for the client component (per docs/architecture.md: "route
// handlers ... are thin wrappers around these [service functions] — never
// parallel logic").
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import type { ServiceCaller } from "@/lib/service/base";
import type { Role } from "@/db/schema";
import {
  listUsers,
  inviteUser,
  updateUserRole,
  setUserActive,
  forcePasswordReset,
  type SafeUser,
  type InviteUserInput,
  type InviteUserResult,
  type ForcePasswordResetResult,
} from "@/lib/service/users";

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

export async function listUsersAction(): Promise<ActionResult<SafeUser[]>> {
  return toResult(async () => {
    const caller = await callerFromSession();
    return listUsers(db, caller);
  });
}

export async function inviteUserAction(input: InviteUserInput): Promise<ActionResult<InviteUserResult>> {
  const caller = await callerFromSession();
  const result = await toResult(() => inviteUser(db, caller, input));
  if (result.ok) revalidatePath("/admin/settings/users");
  return result;
}

export async function updateUserRoleAction(
  userId: string,
  role: Role,
): Promise<ActionResult<SafeUser>> {
  const caller = await callerFromSession();
  const result = await toResult(() => updateUserRole(db, caller, userId, { role }));
  if (result.ok) revalidatePath("/admin/settings/users");
  return result;
}

export async function setUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<ActionResult<SafeUser>> {
  const caller = await callerFromSession();
  const result = await toResult(() => setUserActive(db, caller, userId, { isActive }));
  if (result.ok) revalidatePath("/admin/settings/users");
  return result;
}

export async function forcePasswordResetAction(
  userId: string,
): Promise<ActionResult<ForcePasswordResetResult>> {
  const caller = await callerFromSession();
  const result = await toResult(() => forcePasswordReset(db, caller, userId));
  if (result.ok) revalidatePath("/admin/settings/users");
  return result;
}
