import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { displays, screens } from "@/db/schema";
import { createSchedule, updateSchedule, deleteSchedule, listSchedulesForDisplay } from "./schedules";
import { revertAuditEntry } from "./base/audit";
import type { ServiceCaller } from "./base";
import { AuthError } from "@/lib/auth/role-guard";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000aa" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

const staff: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000bb" },
  surface: "admin_ui",
  role: "staff",
  isActive: true,
};

async function seedScreen(db: Database, name = "Draft List") {
  const [screen] = await db.insert(screens).values({ name, template: "list", sourceMode: "query" }).returning();
  return screen;
}

async function seedDisplay(db: Database, screenId: string | null = null, name = "TV 1") {
  const [display] = await db.insert(displays).values({ name, screenId }).returning();
  return display;
}

describe("schedules service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("creates, updates, and deletes a schedule rule (owner only)", async () => {
    const screen = await seedScreen(db);
    const happyHourScreen = await seedScreen(db, "Happy Hour");
    const display = await seedDisplay(db, screen.id);

    await expect(
      createSchedule(db, staff, {
        displayId: display.id,
        days: [1, 2, 3, 4, 5],
        startTime: "16:00",
        endTime: "19:00",
        screenId: happyHourScreen.id,
      }),
    ).rejects.toThrow(AuthError);

    const created = await createSchedule(db, owner, {
      displayId: display.id,
      days: [1, 1, 2], // duplicate should dedupe
      startTime: "16:00",
      endTime: "19:00",
      screenId: happyHourScreen.id,
    });
    expect(created.days).toEqual([1, 2]);
    expect(created.priority).toBe(0);

    const list = await listSchedulesForDisplay(db, display.id);
    expect(list).toHaveLength(1);

    const updated = await updateSchedule(db, owner, created.id, { priority: 5 });
    expect(updated.priority).toBe(5);

    await deleteSchedule(db, owner, created.id);
    expect(await listSchedulesForDisplay(db, display.id)).toHaveLength(0);
  });

  it("rejects an unknown display or screen", async () => {
    const screen = await seedScreen(db, "Unknown-display-target");
    await expect(
      createSchedule(db, owner, {
        displayId: "00000000-0000-0000-0000-000000000000",
        days: [0],
        startTime: "10:00",
        endTime: "11:00",
        screenId: screen.id,
      }),
    ).rejects.toThrow("display not found");

    const display = await seedDisplay(db, null, "TV-for-unknown-screen");
    await expect(
      createSchedule(db, owner, {
        displayId: display.id,
        days: [0],
        startTime: "10:00",
        endTime: "11:00",
        screenId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow("screen not found");
  });

  it("rejects a malformed time string", async () => {
    const screen = await seedScreen(db, "Malformed-time-screen");
    const display = await seedDisplay(db, null, "TV-malformed-time");
    await expect(
      createSchedule(db, owner, {
        displayId: display.id,
        days: [0],
        startTime: "25:00",
        endTime: "11:00",
        screenId: screen.id,
      }),
    ).rejects.toThrow();
  });

  it("revert restores a deleted schedule row", async () => {
    const screen = await seedScreen(db, "Revert-screen");
    const display = await seedDisplay(db, null, "TV-revert");
    const created = await createSchedule(db, owner, {
      displayId: display.id,
      days: [6],
      startTime: "09:00",
      endTime: "12:00",
      screenId: screen.id,
    });

    await deleteSchedule(db, owner, created.id);
    expect(await listSchedulesForDisplay(db, display.id)).toHaveLength(0);

    // Manually invoke the generic revert dispatcher against the delete's own
    // audit row (mirrors screens.test.ts's revert-coverage style).
    const { auditLog } = await import("@/db/schema");
    const { desc, eq } = await import("drizzle-orm");
    const [deleteEntry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "delete_display_schedule"))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    await revertAuditEntry(db, deleteEntry.id, { actor: owner.actor, surface: owner.surface });

    expect(await listSchedulesForDisplay(db, display.id)).toHaveLength(1);
  });
});
