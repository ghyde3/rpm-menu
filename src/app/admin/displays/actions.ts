"use server";

// Thin server-action wrappers over src/lib/service/displays.ts +
// src/lib/service/schedules.ts (docs/architecture.md: "route handlers ...
// are thin wrappers around these [service functions] — never parallel
// logic"). Mirrors src/app/admin/screens/actions.ts's shape.
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import type { ServiceCaller } from "@/lib/service/base";
import {
  claimPairingCode,
  listDisplays,
  updateDisplay,
  revokeDisplay,
  deleteDisplay,
  type ClaimPairingCodeInput,
  type UpdateDisplayInput,
  type Display,
  type DisplayWithStatus,
} from "@/lib/service/displays";
import {
  listSchedulesForDisplay,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type CreateScheduleInput,
  type UpdateScheduleInput,
  type DisplaySchedule,
} from "@/lib/service/schedules";

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

function revalidateDisplays() {
  revalidatePath("/admin/displays");
}

export async function listDisplaysAction(): Promise<ActionResult<DisplayWithStatus[]>> {
  try {
    const caller = await currentCaller();
    return { ok: true, data: await listDisplays(db, caller) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function claimPairingCodeAction(input: ClaimPairingCodeInput): Promise<ActionResult<Display>> {
  try {
    const caller = await currentCaller();
    const created = await claimPairingCode(db, caller, input);
    revalidateDisplays();
    return { ok: true, data: created };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateDisplayAction(
  displayId: string,
  input: UpdateDisplayInput,
): Promise<ActionResult<Display>> {
  try {
    const caller = await currentCaller();
    const updated = await updateDisplay(db, caller, displayId, input);
    revalidateDisplays();
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function revokeDisplayAction(displayId: string): Promise<ActionResult<Display>> {
  try {
    const caller = await currentCaller();
    const revoked = await revokeDisplay(db, caller, displayId);
    revalidateDisplays();
    return { ok: true, data: revoked };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteDisplayAction(displayId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteDisplay(db, caller, displayId);
    revalidateDisplays();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

// --- Schedules ------------------------------------------------------------

export async function listSchedulesAction(displayId: string): Promise<ActionResult<DisplaySchedule[]>> {
  try {
    await currentCaller();
    return { ok: true, data: await listSchedulesForDisplay(db, displayId) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createScheduleAction(input: CreateScheduleInput): Promise<ActionResult<DisplaySchedule>> {
  try {
    const caller = await currentCaller();
    const created = await createSchedule(db, caller, input);
    revalidateDisplays();
    return { ok: true, data: created };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateScheduleAction(
  scheduleId: string,
  input: UpdateScheduleInput,
): Promise<ActionResult<DisplaySchedule>> {
  try {
    const caller = await currentCaller();
    const updated = await updateSchedule(db, caller, scheduleId, input);
    revalidateDisplays();
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteScheduleAction(scheduleId: string): Promise<ActionResult> {
  try {
    const caller = await currentCaller();
    await deleteSchedule(db, caller, scheduleId);
    revalidateDisplays();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
