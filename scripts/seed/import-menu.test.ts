// Integration coverage for the real seed's menu-import path: runs the exact
// `importMenu()` entry point `npm run db:seed` calls, against an isolated
// in-memory PGlite DB (createTestDb() — concurrency-safe, never touches
// .data/pglite), and asserts on the persisted rows. This is the strongest
// regression guard against the aliases wiring (or any other import-menu.ts
// change) silently breaking without hand-duplicating import logic in the
// test itself.
import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import {
  items,
  modifierGroups,
  modifierOptions,
  modifierGroupAttachments,
  venueSettings,
  VENUE_SETTINGS_ID,
} from "@/db/schema";
import { importMenu } from "./import-menu";

/** Finds the modifier option labeled `optionLabel` attached (directly, via
 * `modifier_group_attachments.item_id`) to the item named `itemName`. Several
 * distinct "Protein Choice"/"Substitute Protein" groups exist (one per item,
 * addProteinChoiceGroup creates a fresh group per call) and option labels
 * like "Chicken" repeat across them — a plain `WHERE label = ...` query is
 * ambiguous, so this always resolves through the specific item's attachment. */
async function findItemSubstitutionOption(db: Database, itemName: string, optionLabel: string) {
  const [item] = await db.select().from(items).where(eq(items.name, itemName));
  expect(item, `expected a seeded item named "${itemName}"`).toBeTruthy();
  const attachments = await db
    .select()
    .from(modifierGroupAttachments)
    .where(eq(modifierGroupAttachments.itemId, item.id));
  const optionsAcrossGroups = (
    await Promise.all(
      attachments.map((a) => db.select().from(modifierOptions).where(eq(modifierOptions.groupId, a.groupId))),
    )
  ).flat();
  const match = optionsAcrossGroups.find((o) => o.label === optionLabel);
  expect(match, `expected item "${itemName}" to have a "${optionLabel}" modifier option`).toBeTruthy();
  return match!;
}

describe("importMenu", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
    // importMenu() writes venue_settings via an UPDATE keyed on
    // VENUE_SETTINGS_ID — matches scripts/seed/index.ts's real ordering
    // (the singleton row is created before importMenu() runs).
    await db.insert(venueSettings).values({ id: VENUE_SETTINGS_ID });
    await importMenu(db);
  }, 30_000);

  it("seeds the expected total item count (hard assertion inside importMenu also covers this)", async () => {
    const all = await db.select({ id: items.id }).from(items);
    expect(all.length).toBe(101);
  });

  it("populates aliases for the task's named examples (BLT, reuben, corndog)", async () => {
    const cases: { name: string; expectedAlias: string }[] = [
      { name: "Blackened Chicken BLT", expectedAlias: "BLT" },
      { name: "Monster Reuben", expectedAlias: "Reuben" },
      { name: "Foot Long Corndogs", expectedAlias: "Corndog" },
    ];
    for (const { name, expectedAlias } of cases) {
      const [row] = await db.select().from(items).where(eq(items.name, name));
      expect(row, `expected a seeded item named "${name}"`).toBeTruthy();
      expect(row.aliases).toContain(expectedAlias);
    }
  });

  it("populates the PRD §3.7 demo alias (Coors Light -> Coors)", async () => {
    const [row] = await db.select().from(items).where(eq(items.name, "Coors Light"));
    expect(row.aliases).toContain("Coors");
  });

  it("leaves items with no curated alias at an empty array, not null/undefined", async () => {
    const [row] = await db.select().from(items).where(eq(items.name, "Churros"));
    expect(row.aliases).toEqual([]);
  });

  it("gives more than a handful of items a populated aliases array", async () => {
    const all = await db.select({ aliases: items.aliases }).from(items);
    const withAliases = all.filter((r) => r.aliases.length > 0);
    // Sanity floor well under the ~55 curated map entries, so this doesn't
    // become brittle against future menu-text edits shifting exact counts.
    expect(withAliases.length).toBeGreaterThanOrEqual(30);
  });

  // Addendum §3/§5 spot checks the task asked this unit to audit for, kept
  // here as regression coverage since the assertions already exist inline in
  // importMenu() but a failed inline assertion just throws during seeding —
  // this gives an isolated, readable test-runner signal for the same facts.
  it("keeps the Wing Sauce Choice group at exactly 12 options", async () => {
    const [group] = await db.select().from(modifierGroups).where(eq(modifierGroups.name, "Wing Sauce Choice"));
    const options = await db.select().from(modifierOptions).where(eq(modifierOptions.groupId, group.id));
    expect(options.length).toBe(12);
  });

  it("never leaves an ambiguous modifier option with a resolved price", async () => {
    const all = await db.select().from(modifierOptions).where(eq(modifierOptions.pricingMode, "ambiguous"));
    for (const opt of all) {
      expect(opt.priceDeltaCents, `"${opt.label}" is ambiguous but has priceDeltaCents set`).toBeNull();
      expect(opt.replacementPriceCents, `"${opt.label}" is ambiguous but has replacementPriceCents set`).toBeNull();
    }
  });

  it("resolves the three addendum §5.2 substitution upcharges to delta pricing", async () => {
    const cases: { itemName: string; optionLabel: string }[] = [
      { itemName: "Blackened Chicken BLT", optionLabel: "Grilled Salmon" },
      { itemName: "Street Tacos", optionLabel: "Fried Shrimp w/ Thai Chili" },
      { itemName: "Blackened Salmon Caesar", optionLabel: "Chicken" },
    ];
    for (const { itemName, optionLabel } of cases) {
      const opt = await findItemSubstitutionOption(db, itemName, optionLabel);
      expect(opt.pricingMode, `"${itemName}" -> "${optionLabel}"`).toBe("delta");
      expect(opt.priceDeltaCents, `"${itemName}" -> "${optionLabel}"`).not.toBeNull();
    }
  });

  it("gives Dessert of the Day the ask_server pricing type and its featured slot", async () => {
    const [row] = await db.select().from(items).where(eq(items.name, "Dessert of the Day"));
    expect(row.pricingType).toBe("ask_server");
    expect(row.priceCents).toBeNull();
    expect(row.featuredSlotKey).toBe("dessert_of_the_day");
  });

  it("is idempotent-safe: re-running importMenu() against an already-seeded db is a no-op, not a duplicate insert", async () => {
    const before = await db.select({ id: items.id }).from(items);
    await importMenu(db); // guarded by import-menu.ts's own `existingItemCount > 0` early return
    const after = await db.select({ id: items.id }).from(items);
    expect(after.length).toBe(before.length);
  });
});
