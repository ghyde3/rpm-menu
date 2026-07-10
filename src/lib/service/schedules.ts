// Weekly display-schedule CRUD (PRD §3.2a, addendum context): "Each display
// gets an optional weekly schedule: ordered rules of `(days, start_time,
// end_time) -> screen`, plus a default screen when no rule matches ...
// Schedule changes are audited like everything else."
//
// Zod validation lives inline in this file rather than a shared
// src/lib/validation/schedules.ts — this unit's owns_paths don't include the
// validation directory (mirrors settings/venue.ts's documented rationale for
// the same situation).
//
// Role: PRD §3.8 — the whole Settings section (where the schedule editor
// lives, per this unit's spec) is "Phase 1, owner-only." Every mutation here
// requires the owner role; reads do too, since schedules are only ever
// surfaced inside the owner-only Displays settings tab.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { displaySchedules, displays, screens } from "@/db/schema";
import {
  requireOwnerCaller,
  withAudit,
  bumpAffectedScreens,
  registerRevertHandler,
  type DbClient,
  type ServiceCaller,
} from "./base";
import { NotFoundError, ConflictError } from "./base/errors";

export type DisplaySchedule = typeof displaySchedules.$inferSelect;

// --- Validation -------------------------------------------------------

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, "Expected 24-hour \"HH:MM\" (or \"HH:MM:SS\")");

const daysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Select at least one day")
  .transform((days) => Array.from(new Set(days)).sort((a, b) => a - b));

export const createScheduleSchema = z.object({
  displayId: z.uuid(),
  days: daysSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  screenId: z.uuid(),
  priority: z.number().int().min(0).max(1000).default(0),
});
export type CreateScheduleInput = z.input<typeof createScheduleSchema>;

/** Deliberately not `.partial()` on `createScheduleSchema` — see
 * validation/screens.ts's documented Zod v4 `.default()` + `.partial()`
 * interaction gotcha; every field is spelled out plain-optional instead so
 * an absent key means "leave unchanged," not "reset to schema default." */
export const updateScheduleSchema = z.object({
  days: daysSchema.optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  screenId: z.uuid().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
});
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

// --- Reads --------------------------------------------------------------

export async function listSchedulesForDisplay(db: DbClient, displayId: string): Promise<DisplaySchedule[]> {
  return db.select().from(displaySchedules).where(eq(displaySchedules.displayId, displayId));
}

async function getScheduleOrThrow(db: DbClient, id: string): Promise<DisplaySchedule> {
  const [row] = await db.select().from(displaySchedules).where(eq(displaySchedules.id, id));
  if (!row) throw new NotFoundError("display_schedule", id);
  return row;
}

async function assertDisplayExists(db: DbClient, displayId: string): Promise<void> {
  const [row] = await db.select({ id: displays.id }).from(displays).where(eq(displays.id, displayId));
  if (!row) throw new NotFoundError("display", displayId);
}

async function assertScreenExists(db: DbClient, screenId: string): Promise<void> {
  const [row] = await db.select({ id: screens.id }).from(screens).where(eq(screens.id, screenId));
  if (!row) throw new NotFoundError("screen", screenId);
}

// --- Writes ---------------------------------------------------------------

export async function createSchedule(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateScheduleInput,
): Promise<DisplaySchedule> {
  requireOwnerCaller(caller);
  const input = createScheduleSchema.parse(rawInput);
  await assertDisplayExists(db, input.displayId);
  await assertScreenExists(db, input.screenId);

  const created = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_display_schedule",
      entityType: "display_schedule",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db.insert(displaySchedules).values(input).returning();
      return { result: after, after };
    },
  );

  // Schedule content itself isn't cached/versioned anywhere — the poll route
  // re-evaluates the active schedule fresh every request (§3.2a) — but every
  // mutation still runs through the shared bump per docs/architecture.md,
  // and bumping the referenced screen keeps its own version consistent if
  // this is the first rule to reference it.
  await bumpAffectedScreens(db, { screenIds: [created.screenId] });
  return created;
}

export async function updateSchedule(
  db: DbClient,
  caller: ServiceCaller,
  scheduleId: string,
  rawInput: UpdateScheduleInput,
): Promise<DisplaySchedule> {
  requireOwnerCaller(caller);
  const input = updateScheduleSchema.parse(rawInput);
  const before = await getScheduleOrThrow(db, scheduleId);
  if (input.screenId) await assertScreenExists(db, input.screenId);

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_display_schedule",
      entityType: "display_schedule",
      entityId: scheduleId,
      before,
    },
    async () => {
      const [after] = await db
        .update(displaySchedules)
        .set(input)
        .where(eq(displaySchedules.id, scheduleId))
        .returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, { screenIds: [before.screenId, updated.screenId] });
  return updated;
}

export async function deleteSchedule(db: DbClient, caller: ServiceCaller, scheduleId: string): Promise<void> {
  requireOwnerCaller(caller);
  const before = await getScheduleOrThrow(db, scheduleId);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_display_schedule",
      entityType: "display_schedule",
      entityId: scheduleId,
      before,
    },
    async () => {
      await db.delete(displaySchedules).where(eq(displaySchedules.id, scheduleId));
      return { result: undefined, after: null };
    },
  );

  await bumpAffectedScreens(db, { screenIds: [before.screenId] });
}

// --- Revert registration ----------------------------------------------

registerRevertHandler("display_schedule", async (db, ctx) => {
  if (ctx.before === null || ctx.before === undefined) {
    if (!ctx.entityId) throw new ConflictError("display_schedule revert requires an entity_id");
    await db.delete(displaySchedules).where(eq(displaySchedules.id, ctx.entityId));
    return;
  }
  const before = ctx.before as DisplaySchedule;
  const existing = await db
    .select({ id: displaySchedules.id })
    .from(displaySchedules)
    .where(eq(displaySchedules.id, before.id));
  if (existing.length === 0) {
    await db.insert(displaySchedules).values(before);
  } else {
    await db.update(displaySchedules).set(before).where(eq(displaySchedules.id, before.id));
  }
});
