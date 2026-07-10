"use server";

// Thin server-action wrappers over src/lib/service/bulk-ops.ts +
// src/lib/service/pending-changes.ts (docs/architecture.md: "Admin UI route
// handlers ... are thin wrappers around these -- never parallel logic").
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import { previewBulkOperation, applyBulkOperation, type BulkDiffRow, type BulkChangeType } from "@/lib/service/bulk-ops";
import { cancelPendingChange } from "@/lib/service/pending-changes";

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

function revalidateBulk() {
  revalidatePath("/admin/items");
  revalidatePath("/admin/settings/audit-log");
}

export interface BulkPreviewActionResult {
  pendingChangeId: string;
  changeType: BulkChangeType;
  /** ISO string -- Dates cross the server-action boundary fine in practice,
   * but an explicit ISO string keeps this contract unambiguous for the
   * client component. */
  expiresAt: string;
  diff: BulkDiffRow[];
}

export async function previewBulkOperationAction(rawInput: unknown): Promise<ActionResult<BulkPreviewActionResult>> {
  try {
    const caller = await currentCaller();
    const preview = await previewBulkOperation(db, caller, rawInput);
    return {
      ok: true,
      data: {
        pendingChangeId: preview.pendingChangeId,
        changeType: preview.changeType,
        expiresAt: preview.expiresAt.toISOString(),
        diff: preview.diff,
      },
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export interface BulkApplyActionResult {
  pendingChangeId: string;
  changeType: BulkChangeType;
  appliedCount: number;
  skippedCount: number;
}

export async function applyBulkOperationAction(pendingChangeId: string): Promise<ActionResult<BulkApplyActionResult>> {
  try {
    const caller = await currentCaller();
    const result = await applyBulkOperation(db, caller, pendingChangeId);
    revalidateBulk();
    return {
      ok: true,
      data: {
        pendingChangeId: result.pendingChangeId,
        changeType: result.changeType,
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
      },
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function cancelBulkPreviewAction(pendingChangeId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await cancelPendingChange(db, caller, pendingChangeId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
