import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories, items, users } from "@/db/schema";
import { getBackupStatus, exportFullData } from "./data-recovery";
import type { ServiceCaller } from "../base";

function ownerCaller(id: string): ServiceCaller {
  return { actor: { type: "user", id }, surface: "admin_ui", role: "owner", isActive: true };
}
function staffCaller(id: string): ServiceCaller {
  return { actor: { type: "user", id }, surface: "admin_ui", role: "staff", isActive: true };
}

async function seedOwner(db: Database) {
  const [owner] = await db
    .insert(users)
    .values({ email: `owner-${randomUUID()}@rpmpub.example`, name: "Owner", role: "owner", emailVerified: true })
    .returning();
  return owner;
}

describe("data-recovery service", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("getBackupStatus", () => {
    const ENV_VAR = "BACKUP_LAST_SUCCESS_AT";
    afterEach(() => {
      delete process.env[ENV_VAR];
    });

    it("reports not_configured when the env var is unset", async () => {
      const owner = await seedOwner(db);
      const status = await getBackupStatus(db, ownerCaller(owner.id));
      expect(status.source).toBe("not_configured");
      expect(status.lastSuccessfulBackupAt).toBeNull();
    });

    it("reports not_configured when the env var is unparseable", async () => {
      const owner = await seedOwner(db);
      process.env[ENV_VAR] = "not-a-date";
      const status = await getBackupStatus(db, ownerCaller(owner.id));
      expect(status.source).toBe("not_configured");
    });

    it("reads a valid timestamp from the env var", async () => {
      const owner = await seedOwner(db);
      process.env[ENV_VAR] = "2026-07-08T03:00:00.000Z";
      const status = await getBackupStatus(db, ownerCaller(owner.id));
      expect(status.source).toBe("env");
      expect(status.lastSuccessfulBackupAt?.toISOString()).toBe("2026-07-08T03:00:00.000Z");
    });

    it("rejects a non-owner caller", async () => {
      const owner = await seedOwner(db);
      await expect(getBackupStatus(db, staffCaller(owner.id))).rejects.toThrow();
    });
  });

  describe("exportFullData", () => {
    it("includes menu/screens/settings and auto-creates the venue_settings singleton", async () => {
      const owner = await seedOwner(db);
      const [category] = await db
        .insert(categories)
        .values({ name: "Burgers", type: "food" })
        .returning();
      await db.insert(items).values({ name: "RPM Burger", priceCents: 1195, categoryId: category.id });

      const dump = await exportFullData(db, ownerCaller(owner.id));

      expect(dump.version).toBe(1);
      expect(typeof dump.exportedAt).toBe("string");
      expect(dump.menu.categories).toHaveLength(1);
      expect(dump.menu.items).toHaveLength(1);
      expect(dump.menu.items[0].name).toBe("RPM Burger");
      expect(dump.settings).toBeTruthy();
      expect(dump.settings.id).toBe("00000000-0000-0000-0000-000000000001");
      expect(dump.screens.screens).toEqual([]);
      expect(dump.displays.displays).toEqual([]);
    });

    it("omits display token hashes from the export shape", async () => {
      const owner = await seedOwner(db);
      const dump = await exportFullData(db, ownerCaller(owner.id));
      for (const d of dump.displays.displays) {
        expect(d).not.toHaveProperty("tokenHash");
      }
    });

    it("rejects a non-owner caller", async () => {
      const owner = await seedOwner(db);
      await expect(exportFullData(db, staffCaller(owner.id))).rejects.toThrow();
    });

    it("is valid JSON round-trippable output", async () => {
      const owner = await seedOwner(db);
      const dump = await exportFullData(db, ownerCaller(owner.id));
      const json = JSON.stringify(dump);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
    });
  });
});
