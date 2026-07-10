"use server";

// Thin server-action wrappers over src/lib/service/settings/sessions.ts.
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import type { ServiceCaller } from "@/lib/service/base";
import {
  listMySessions,
  revokeSession,
  signOutEverywhere,
  changeMyPassword,
  getTotpStatus,
  startTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  type SafeSession,
  type ChangePasswordInput,
  type TotpStatus,
  type StartTotpEnrollmentResult,
  type ConfirmTotpEnrollmentResult,
} from "@/lib/service/settings/sessions";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function callerAndSessionId(): Promise<{ caller: ServiceCaller; sessionId?: string }> {
  const session = await getCurrentSession();
  return {
    caller: {
      actor: { type: "user", id: session?.user.id ?? null },
      surface: "admin_ui",
      role: session?.user.role,
      isActive: session?.user.isActive,
    },
    sessionId: session?.session.id,
  };
}

async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function listMySessionsAction(): Promise<ActionResult<SafeSession[]>> {
  return toResult(async () => {
    const { caller, sessionId } = await callerAndSessionId();
    return listMySessions(db, caller, sessionId);
  });
}

export async function revokeSessionAction(sessionId: string): Promise<ActionResult<null>> {
  const { caller } = await callerAndSessionId();
  const result = await toResult(async () => {
    await revokeSession(db, caller, sessionId);
    return null;
  });
  if (result.ok) revalidatePath("/admin/settings/sessions");
  return result;
}

/** Deletes every session row for the caller, including the one making this
 * request. The client's session cookie survives the call (this is a Server
 * Action, not a route handler that could clear it), but that's harmless --
 * `admin/layout.tsx` calls `getCurrentSession()` on every request, which
 * re-checks the DB and redirects to `/login` the instant the row is gone
 * regardless of what the stale cookie still says. The UI navigates to
 * `/login` right after this resolves to make that immediate rather than
 * waiting for the next natural navigation. */
export async function signOutEverywhereAction(): Promise<ActionResult<{ revokedCount: number }>> {
  const { caller } = await callerAndSessionId();
  const result = await toResult(() => signOutEverywhere(db, caller));
  if (result.ok) revalidatePath("/admin/settings/sessions");
  return result;
}

export async function changeMyPasswordAction(input: ChangePasswordInput): Promise<ActionResult<null>> {
  const { caller } = await callerAndSessionId();
  const result = await toResult(async () => {
    await changeMyPassword(db, caller, input);
    return null;
  });
  if (result.ok) revalidatePath("/admin/settings/sessions");
  return result;
}

export async function getTotpStatusAction(): Promise<ActionResult<TotpStatus>> {
  const { caller } = await callerAndSessionId();
  return toResult(() => getTotpStatus(db, caller));
}

export async function startTotpEnrollmentAction(): Promise<ActionResult<StartTotpEnrollmentResult>> {
  const { caller } = await callerAndSessionId();
  return toResult(() => startTotpEnrollment(db, caller));
}

export async function confirmTotpEnrollmentAction(
  token: string,
): Promise<ActionResult<ConfirmTotpEnrollmentResult>> {
  const { caller } = await callerAndSessionId();
  const result = await toResult(() => confirmTotpEnrollment(db, caller, token));
  if (result.ok) revalidatePath("/admin/settings/sessions");
  return result;
}

export async function disableTotpAction(token: string): Promise<ActionResult<null>> {
  const { caller } = await callerAndSessionId();
  const result = await toResult(async () => {
    await disableTotp(db, caller, token);
    return null;
  });
  if (result.ok) revalidatePath("/admin/settings/sessions");
  return result;
}
