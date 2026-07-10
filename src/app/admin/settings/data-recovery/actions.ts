"use server";

// Thin server-action wrappers over src/lib/service/settings/data-recovery.ts.
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import type { ServiceCaller } from "@/lib/service/base";
import { exportFullData, type FullDataExport } from "@/lib/service/settings/data-recovery";

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

/** Returns the export as a JSON string ready to hand to the browser as a
 * downloadable Blob -- server actions can only return serializable values,
 * and a pre-stringified payload avoids a second JSON.stringify on the
 * client for a dump that can get sizable. */
export async function exportFullDataAction(): Promise<ActionResult<{ filename: string; json: string }>> {
  try {
    const caller = await callerFromSession();
    const dump: FullDataExport = await exportFullData(db, caller);
    const filename = `rpm-menu-export-${dump.exportedAt.slice(0, 10)}.json`;
    return { ok: true, data: { filename, json: JSON.stringify(dump, null, 2) } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
