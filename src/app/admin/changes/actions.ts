"use server";

// Thin server-action wrappers over src/lib/service/revert.ts (docs/
// architecture.md: "Admin UI route handlers ... are thin wrappers around
// these -- never parallel logic").
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import { revertChange, revertBulkGroup } from "@/lib/service/revert";

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

function revalidateChanges() {
  revalidatePath("/admin/changes");
  revalidatePath("/admin/items");
  revalidatePath("/admin/items/bulk");
}

export async function revertChangeAction(auditEntryId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await revertChange(db, caller, auditEntryId);
    revalidateChanges();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function revertBulkGroupAction(pendingChangeId: string): Promise<ActionResult<{ revertedCount: number }>> {
  try {
    const caller = await currentCaller();
    const result = await revertBulkGroup(db, caller, pendingChangeId);
    revalidateChanges();
    return { ok: true, data: { revertedCount: result.revertedCount } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
