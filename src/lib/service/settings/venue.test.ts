import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { displays, displaySchedules, screens, venueSettings, VENUE_SETTINGS_ID } from "@/db/schema";
import { getVenueSettings, previewTimezoneChange, updateVenueSettings } from "./venue";
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

describe("settings/venue service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("auto-creates the singleton row with schema defaults on first read", async () => {
    const settings = await getVenueSettings(db);
    expect(settings.id).toBe(VENUE_SETTINGS_ID);
    expect(settings.name).toBe("RPM Pub");
    expect(settings.timezone).toBe("America/Chicago");
  });

  it("updates only the fields supplied, leaving others untouched", async () => {
    await getVenueSettings(db);
    const updated = await updateVenueSettings(db, owner, {
      name: "RPM Pub & Grill",
      phone: "555-1234",
    });
    expect(updated.name).toBe("RPM Pub & Grill");
    expect(updated.phone).toBe("555-1234");
    expect(updated.timezone).toBe("America/Chicago");

    const again = await updateVenueSettings(db, owner, { address: "123 Main St" });
    expect(again.name).toBe("RPM Pub & Grill");
    expect(again.address).toBe("123 Main St");
  });

  it("validates and persists social links, hours, and currency format", async () => {
    const updated = await updateVenueSettings(db, owner, {
      social: { website: "https://rpmpub.example", instagram: "@rpmpub" },
      hours: { monday: { open: "11:00", close: "22:00" }, sunday: { closed: true } },
      currencyFormat: { symbol: "$", showTrailingZeros: { web: true, display: false } },
    });
    expect(updated.social.website).toBe("https://rpmpub.example");
    expect(updated.hours.monday?.open).toBe("11:00");
    expect(updated.hours.sunday?.closed).toBe(true);
    expect(updated.currencyFormat.showTrailingZeros?.display).toBe(false);
  });

  it("accepts a valid IANA timezone and rejects an invalid one", async () => {
    const updated = await updateVenueSettings(db, owner, { timezone: "America/New_York" });
    expect(updated.timezone).toBe("America/New_York");

    await expect(updateVenueSettings(db, owner, { timezone: "Not/AZone" })).rejects.toThrow();
  });

  it("rejects mutation from a staff (non-owner) actor", async () => {
    await expect(updateVenueSettings(db, staff, { name: "Hijacked" })).rejects.toThrow();
  });

  it("previewTimezoneChange counts affected display_schedules without mutating anything", async () => {
    const [screen] = await db.insert(screens).values({ name: "Main Screen", template: "list" }).returning();
    const [display] = await db.insert(displays).values({ name: "Bar TV", screenId: screen.id }).returning();
    await db.insert(displaySchedules).values([
      { displayId: display.id, days: [1, 2, 3, 4, 5], startTime: "11:00", endTime: "22:00", screenId: screen.id },
      { displayId: display.id, days: [0, 6], startTime: "10:00", endTime: "23:00", screenId: screen.id },
    ]);

    const before = await getVenueSettings(db);
    const impact = await previewTimezoneChange(db, "America/Denver");
    expect(impact.currentTimezone).toBe(before.timezone);
    expect(impact.newTimezone).toBe("America/Denver");
    expect(impact.changed).toBe(true);
    expect(impact.affectedScheduleCount).toBe(2);
    expect(impact.affectedDisplayCount).toBe(1);

    // Preview must not have mutated the row.
    const [row] = await db.select().from(venueSettings).where(eq(venueSettings.id, VENUE_SETTINGS_ID));
    expect(row.timezone).toBe(before.timezone);
  });

  it("previewTimezoneChange reports changed:false when the timezone is unchanged", async () => {
    const current = await getVenueSettings(db);
    const impact = await previewTimezoneChange(db, current.timezone);
    expect(impact.changed).toBe(false);
  });
});
