import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { auditLog, categories } from "@/db/schema";
import { withAudit, revertAuditEntry, registerRevertHandler, RevertError } from "./audit";
import { reviveDates } from "./revert-helpers";
import type { Actor } from "./actor";

const systemActor: Actor = { type: "system", id: null };

describe("withAudit + revertAuditEntry", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
    // A minimal revert handler for this test's own entity_type, registered
    // the same way a real domain service module (items.ts, categories.ts)
    // would at import time.
    registerRevertHandler("category", async (tx, ctx) => {
      if (!ctx.entityId) return;
      if (ctx.before === null || ctx.before === undefined) {
        await tx.delete(categories).where(eq(categories.id, ctx.entityId));
        return;
      }
      const before = reviveDates(
        ctx.before as { createdAt: unknown; updatedAt: unknown } & Record<string, unknown>,
        ["createdAt", "updatedAt"],
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.update(categories).set(before as any).where(eq(categories.id, ctx.entityId));
    });
  });

  it("writes one audit_log row with actor/surface/action/before/after", async () => {
    const [created] = await db
      .insert(categories)
      .values({ name: "Appetizers", type: "food" })
      .returning();

    const updated = await withAudit(
      db,
      {
        actor: systemActor,
        surface: "api",
        action: "update_category",
        entityType: "category",
        entityId: created.id,
        before: created,
      },
      async () => {
        const [after] = await db
          .update(categories)
          .set({ name: "Starters" })
          .where(eq(categories.id, created.id))
          .returning();
        return { result: after, after };
      },
    );
    expect(updated.name).toBe("Starters");

    const [row] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id));
    expect(row.actorType).toBe("system");
    expect(row.surface).toBe("api");
    expect(row.action).toBe("update_category");
    expect(row.entityType).toBe("category");
    expect((row.before as { name: string }).name).toBe("Appetizers");
    expect((row.after as { name: string }).name).toBe("Starters");
  });

  it("round-trips a revert: reverting an update restores the prior row and audits the revert itself", async () => {
    const [created] = await db.insert(categories).values({ name: "Drinks", type: "drink" }).returning();

    let auditRowId: string | null = null;
    await withAudit(
      db,
      {
        actor: systemActor,
        surface: "admin_ui",
        action: "update_category",
        entityType: "category",
        entityId: created.id,
        before: created,
      },
      async () => {
        const [after] = await db
          .update(categories)
          .set({ name: "Beverages" })
          .where(eq(categories.id, created.id))
          .returning();
        return { result: after, after };
      },
    );

    const [row] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id));
    auditRowId = row.id;

    const [beforeRevert] = await db.select().from(categories).where(eq(categories.id, created.id));
    expect(beforeRevert.name).toBe("Beverages");

    await revertAuditEntry(db, auditRowId!, { actor: systemActor, surface: "admin_ui" });

    const [afterRevert] = await db.select().from(categories).where(eq(categories.id, created.id));
    expect(afterRevert.name).toBe("Drinks");

    // The revert itself is audited, action prefixed with "revert:".
    const revertRows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id));
    const revertRow = revertRows.find((r) => r.action === "revert:update_category");
    expect(revertRow).toBeDefined();
    expect((revertRow!.before as { name: string }).name).toBe("Beverages");
    expect((revertRow!.after as { name: string }).name).toBe("Drinks");
  });

  it("throws RevertError for an unknown audit_log id", async () => {
    await expect(
      revertAuditEntry(db, "00000000-0000-0000-0000-000000000000", {
        actor: systemActor,
        surface: "api",
      }),
    ).rejects.toThrow(RevertError);
  });

  it("throws RevertError when no handler is registered for the entity_type", async () => {
    const [row] = await db
      .insert(auditLog)
      .values({
        actorType: "system",
        actorId: null,
        surface: "api",
        action: "noop",
        entityType: "display", // no handler registered for this in this test file
        entityId: null,
        before: null,
        after: null,
      })
      .returning();

    await expect(
      revertAuditEntry(db, row.id, { actor: systemActor, surface: "api" }),
    ).rejects.toThrow(RevertError);
  });
});
