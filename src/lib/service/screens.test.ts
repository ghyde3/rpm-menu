import { describe, expect, it, beforeAll } from "vitest";
import { eq, desc } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories, items, screens, auditLog } from "@/db/schema";
import {
  createScreen,
  updateScreen,
  deleteScreen,
  listScreens,
  getScreen,
  listScreenItems,
  setScreenItems,
} from "./screens";
import { revertAuditEntry } from "./base/audit";
import type { ServiceCaller } from "./base";

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

async function seedCategory(db: Database, name = "Drafts") {
  const [category] = await db.insert(categories).values({ name, type: "drink" }).returning();
  return category;
}

async function seedItem(db: Database, categoryId: string, name = "House Lager") {
  const [item] = await db.insert(items).values({ name, categoryId, priceCents: 600 }).returning();
  return item;
}

describe("screens service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("creates, updates, and deletes a screen", async () => {
    const created = await createScreen(db, owner, { name: "Draft List", template: "list", sourceMode: "query" });
    expect(created.name).toBe("Draft List");
    expect(created.template).toBe("list");

    // bumpAffectedScreens runs (and persists to the DB) *after* the created
    // row is returned from the insert, so the in-memory `created` object
    // predates the bump — check the row's committed version instead.
    const [afterCreate] = await db.select().from(screens).where(eq(screens.id, created.id));
    expect(afterCreate.version).toBe(1);

    const updated = await updateScreen(db, owner, created.id, {
      displayOptions: { title: "Drafts on Tap", accentColor: "#c00" },
    });
    expect(updated.displayOptions.title).toBe("Drafts on Tap");

    const [afterUpdate] = await db.select().from(screens).where(eq(screens.id, created.id));
    expect(afterUpdate.version).toBe(2);

    await deleteScreen(db, owner, created.id);
    const rows = await db.select().from(screens).where(eq(screens.id, created.id));
    expect(rows).toHaveLength(0);
  });

  it("lists and gets screens", async () => {
    const created = await createScreen(db, owner, { name: "Grid Board", template: "grid" });
    const all = await listScreens(db);
    expect(all.some((s) => s.id === created.id)).toBe(true);
    const fetched = await getScreen(db, created.id);
    expect(fetched.id).toBe(created.id);
  });

  it("throws NotFoundError for a missing screen", async () => {
    await expect(getScreen(db, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });

  describe("role restrictions (PRD §2: staff cannot manage screens)", () => {
    it("refuses staff create/update/delete", async () => {
      await expect(createScreen(db, staff, { name: "Nope" })).rejects.toThrow();

      const created = await createScreen(db, owner, { name: "Owner Only Screen" });
      await expect(updateScreen(db, staff, created.id, { name: "Hacked" })).rejects.toThrow();
      await expect(deleteScreen(db, staff, created.id)).rejects.toThrow();
      await expect(setScreenItems(db, staff, created.id, { itemIds: [] })).rejects.toThrow();
    });

    it("refuses a mutation from a non-staff/owner user actor", async () => {
      const noRole: ServiceCaller = {
        actor: { type: "user", id: "00000000-0000-0000-0000-0000000000cc" },
        surface: "admin_ui",
        role: undefined,
        isActive: true,
      };
      await expect(createScreen(db, noRole, { name: "Nope" })).rejects.toThrow();
    });
  });

  describe("manual-mode item ordering", () => {
    it("full-replaces the ordered item list and bumps the screen version", async () => {
      const category = await seedCategory(db, "Sandwiches");
      const a = await seedItem(db, category.id, "Reuben");
      const b = await seedItem(db, category.id, "BLT");
      const c = await seedItem(db, category.id, "Club");

      const screen = await createScreen(db, owner, { name: "Curated Specials", sourceMode: "manual" });
      const versionBeforeSet = screen.version;

      await setScreenItems(db, owner, screen.id, { itemIds: [a.id, b.id] });
      let rows = await listScreenItems(db, screen.id);
      expect(rows.map((r) => r.itemId)).toEqual([a.id, b.id]);
      expect(rows.find((r) => r.itemId === a.id)?.sortOrder).toBe(0);
      expect(rows.find((r) => r.itemId === b.id)?.sortOrder).toBe(1);

      const [afterFirstSet] = await db.select().from(screens).where(eq(screens.id, screen.id));
      expect(afterFirstSet.version).toBeGreaterThan(versionBeforeSet);

      // Full replace: reorders and drops `a`, adds `c`.
      await setScreenItems(db, owner, screen.id, { itemIds: [c.id, b.id] });
      rows = await listScreenItems(db, screen.id);
      expect(rows.map((r) => r.itemId)).toEqual([c.id, b.id]);
    });

    it("clears the list when given an empty array", async () => {
      const category = await seedCategory(db, "Empties");
      const a = await seedItem(db, category.id, "Solo Item");
      const screen = await createScreen(db, owner, { name: "Will Be Emptied", sourceMode: "manual" });
      await setScreenItems(db, owner, screen.id, { itemIds: [a.id] });
      await setScreenItems(db, owner, screen.id, { itemIds: [] });
      const rows = await listScreenItems(db, screen.id);
      expect(rows).toHaveLength(0);
    });

    it("rejects an itemId that doesn't exist", async () => {
      const screen = await createScreen(db, owner, { name: "Bad Ref Screen", sourceMode: "manual" });
      await expect(
        setScreenItems(db, owner, screen.id, { itemIds: ["00000000-0000-0000-0000-000000000000"] }),
      ).rejects.toThrow();
    });
  });

  describe("revert", () => {
    // M3 cleanup: `withAudit` (src/lib/service/base/audit.ts) now derives
    // `entity_id` from the mutation's own `after.id` when the caller passes
    // `entityId: null` (the create-time case, since the row doesn't exist
    // yet when the call is made) — every "create_*" audit row across the
    // codebase, this one included, carries its real entity_id from the
    // moment it's written. That makes a create genuinely revertable (=
    // delete) through the generic `revertAuditEntry` dispatcher, same as
    // items.ts/categories.ts.
    it("reverts a create by deleting the row, through the generic dispatcher", async () => {
      const created = await createScreen(db, owner, { name: "Not Revertable" });
      const [auditRow] = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "create_screen"))
        .orderBy(desc(auditLog.createdAt))
        .limit(1);
      expect(auditRow).toBeDefined();
      expect(auditRow.entityId).toBe(created.id);

      await revertAuditEntry(db, auditRow.id, { actor: owner.actor, surface: "admin_ui" });

      const rows = await db.select().from(screens).where(eq(screens.id, created.id));
      expect(rows).toHaveLength(0);
    });

    it("reverts an update by restoring the prior row", async () => {
      const created = await createScreen(db, owner, { name: "Original Name" });
      await updateScreen(db, owner, created.id, { name: "Renamed" });

      const rows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, created.id));
      const updateRow = rows.find((r) => r.action === "update_screen")!;

      await revertAuditEntry(db, updateRow.id, { actor: owner.actor, surface: "admin_ui" });
      const [restored] = await db.select().from(screens).where(eq(screens.id, created.id));
      expect(restored.name).toBe("Original Name");
    });

    it("reverts a set_screen_items mutation by restoring the prior manual-mode order", async () => {
      const category = await seedCategory(db, "Revert Sandwiches");
      const a = await seedItem(db, category.id, "Item A");
      const b = await seedItem(db, category.id, "Item B");

      const screen = await createScreen(db, owner, { name: "Revert Manual Screen", sourceMode: "manual" });
      await setScreenItems(db, owner, screen.id, { itemIds: [a.id] });

      const rows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, screen.id));
      const firstSetRow = rows.find((r) => r.action === "set_screen_items")!;

      // Change it again, then revert the FIRST set_screen_items row: this
      // should restore the state as it was *before* that first mutation
      // ran, i.e. empty (the audit row's `before`, not `after`).
      await setScreenItems(db, owner, screen.id, { itemIds: [a.id, b.id] });

      await revertAuditEntry(db, firstSetRow.id, { actor: owner.actor, surface: "admin_ui" });
      const restoredRows = await listScreenItems(db, screen.id);
      expect(restoredRows).toHaveLength(0);
    });
  });
});
