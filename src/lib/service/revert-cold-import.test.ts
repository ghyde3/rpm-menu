// Regression test for the "cold process" revert gap: revert.ts's own
// side-effect imports (`import "@/lib/service/screens"`, `"./displays"`,
// `"./schedules"`) must be what registers those entity types' revert
// handlers -- not some other module happening to have been imported first
// by an earlier test in the same file/process.
//
// This file deliberately imports ONLY `./revert` (plus schema/table types
// and test-db plumbing) -- never `./screens` directly -- and writes its
// `screens`/`audit_log` rows by hand rather than going through
// `createScreen`/`updateScreen` (src/lib/service/screens.ts), so nothing
// else in this module graph can register the "screen" handler as a side
// effect. Since Vitest gives each test file its own fresh module registry
// (the default `isolate: true`), this genuinely exercises a cold
// `revertHandlers` map the same way a freshly booted server process would.
import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { screens, auditLog } from "@/db/schema";
import { revertChange } from "./revert";
import type { ServiceCaller } from "./base";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000aa" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

describe("revert.ts cold-import registration (screens)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("reverts a screen create (undo = delete) without ever having imported ./screens directly", async () => {
    const [screen] = await db
      .insert(screens)
      .values({ name: "Cold Screen", template: "list", sourceMode: "query" })
      .returning();

    const [auditRow] = await db
      .insert(auditLog)
      .values({
        actorType: "user",
        actorId: owner.actor.id!,
        surface: "admin_ui",
        action: "create_screen",
        entityType: "screen",
        entityId: screen.id,
        before: null,
        after: screen,
      })
      .returning();

    // Would throw "No revert handler registered for entity_type=\"screen\""
    // if revert.ts's `import "@/lib/service/screens"` side effect hadn't
    // run.
    await revertChange(db, owner, auditRow.id);

    const rows = await db.select().from(screens).where(eq(screens.id, screen.id));
    expect(rows).toHaveLength(0);
  });

  it("reverts a screen update by restoring the prior row, same cold-import guarantee", async () => {
    const [screen] = await db
      .insert(screens)
      .values({ name: "Cold Screen Original", template: "list", sourceMode: "query" })
      .returning();

    const before = screen;
    const [updated] = await db
      .update(screens)
      .set({ name: "Cold Screen Renamed", updatedAt: new Date() })
      .where(eq(screens.id, screen.id))
      .returning();

    const [auditRow] = await db
      .insert(auditLog)
      .values({
        actorType: "user",
        actorId: owner.actor.id!,
        surface: "admin_ui",
        action: "update_screen",
        entityType: "screen",
        entityId: screen.id,
        before,
        after: updated,
      })
      .returning();

    await revertChange(db, owner, auditRow.id);

    const [reverted] = await db.select().from(screens).where(eq(screens.id, screen.id));
    expect(reverted.name).toBe("Cold Screen Original");
  });
});
