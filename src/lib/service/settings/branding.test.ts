import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { images, venueSettings, VENUE_SETTINGS_ID } from "@/db/schema";
import { getBrandingSettings, updateBranding, BRANDING_FONT_STACKS } from "./branding";
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

describe("settings/branding service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("reads defaults (empty branding, no logo) before anything is set", async () => {
    const settings = await getBrandingSettings(db);
    expect(settings.logoImageId).toBeNull();
    expect(settings.branding).toEqual({});
  });

  it("updates only the fields supplied, leaving others untouched", async () => {
    const updated = await updateBranding(db, owner, { primaryColor: "#d63a2c" });
    expect(updated.branding.primaryColor).toBe("#d63a2c");
    expect(updated.branding.accentColor).toBeUndefined();

    const again = await updateBranding(db, owner, { accentColor: "#e8632a", font: "oswald" });
    expect(again.branding.primaryColor).toBe("#d63a2c");
    expect(again.branding.accentColor).toBe("#e8632a");
    expect(again.branding.font).toBe("oswald");
  });

  it("sets logoImageId to a real images row id", async () => {
    const [image] = await db
      .insert(images)
      .values({ key: "images/test-logo", variants: { thumb: "/x", card: "/x", display: "/x" } })
      .returning();

    const updated = await updateBranding(db, owner, { logoImageId: image.id });
    expect(updated.logoImageId).toBe(image.id);

    const [row] = await db.select().from(venueSettings).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
    expect(row.logoImageId).toBe(image.id);
  });

  it("clears logoImageId when explicitly set to null", async () => {
    const updated = await updateBranding(db, owner, { logoImageId: null });
    expect(updated.logoImageId).toBeNull();
  });

  it("rejects an invalid hex color", async () => {
    await expect(updateBranding(db, owner, { primaryColor: "red" })).rejects.toThrow();
    await expect(updateBranding(db, owner, { primaryColor: "#zzzzzz" })).rejects.toThrow();
  });

  it("rejects a font outside the curated set", async () => {
    // @ts-expect-error deliberately invalid for the test
    await expect(updateBranding(db, owner, { font: "comic-sans" })).rejects.toThrow();
  });

  it("every curated font option has a resolvable CSS stack", async () => {
    for (const value of Object.keys(BRANDING_FONT_STACKS)) {
      expect(BRANDING_FONT_STACKS[value as keyof typeof BRANDING_FONT_STACKS]).toMatch(/serif|sans-serif/);
    }
  });

  it("rejects mutation from a staff (non-owner) actor", async () => {
    await expect(updateBranding(db, staff, { primaryColor: "#000000" })).rejects.toThrow();
  });
});
