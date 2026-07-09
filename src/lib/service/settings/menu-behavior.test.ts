import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { getMenuBehaviorSettings, updateMenuBehavior } from "./menu-behavior";
import type { ServiceCaller } from "../base";

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

describe("settings/menu-behavior service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("resolves sensible defaults before anything is set", async () => {
    const settings = await getMenuBehaviorSettings(db);
    expect(settings.unavailableTreatment).toBe("badge");
    expect(settings.showImages).toBe(true);
    expect(settings.showPublicTagBadges).toBe(true);
    expect(settings.seoTitle).toBeNull();
    expect(settings.seoDescription).toBeNull();
  });

  it("updates only the fields supplied, leaving others at their resolved value", async () => {
    const updated = await updateMenuBehavior(db, owner, { unavailableTreatment: "hide" });
    expect(updated.unavailableTreatment).toBe("hide");
    expect(updated.showImages).toBe(true);

    const again = await updateMenuBehavior(db, owner, { showImages: false });
    expect(again.unavailableTreatment).toBe("hide");
    expect(again.showImages).toBe(false);
    expect(again.showPublicTagBadges).toBe(true);
  });

  it("persists SEO title/description and allows clearing them", async () => {
    const updated = await updateMenuBehavior(db, owner, {
      seoTitle: "RPM Pub Menu",
      seoDescription: "Wings, burgers, and cold beer.",
    });
    expect(updated.seoTitle).toBe("RPM Pub Menu");
    expect(updated.seoDescription).toBe("Wings, burgers, and cold beer.");

    const cleared = await updateMenuBehavior(db, owner, { seoTitle: null });
    expect(cleared.seoTitle).toBeNull();
    expect(cleared.seoDescription).toBe("Wings, burgers, and cold beer.");
  });

  it("rejects an SEO title longer than 70 chars", async () => {
    await expect(
      updateMenuBehavior(db, owner, { seoTitle: "x".repeat(71) }),
    ).rejects.toThrow();
  });

  it("rejects an unavailableTreatment outside hide|badge", async () => {
    // @ts-expect-error deliberately invalid for the test
    await expect(updateMenuBehavior(db, owner, { unavailableTreatment: "strikethrough" })).rejects.toThrow();
  });

  it("rejects mutation from a staff (non-owner) actor", async () => {
    await expect(updateMenuBehavior(db, staff, { showImages: false })).rejects.toThrow();
  });
});
