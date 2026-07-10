// Unit coverage for the search-alias map itself (fast, no DB). The
// integration-level "did the real seed actually persist these aliases" check
// lives in import-menu.test.ts.
import { describe, expect, it } from "vitest";
import { parseFoodMenu } from "./parse-food";
import { parseDrinksMenu } from "./parse-drinks";
import { ITEM_ALIASES, getItemAliases } from "./aliases";
import path from "node:path";

const FOOD_MD = path.resolve(process.cwd(), "rpm-menu-extracted.md");
const DRINKS_MD = path.resolve(process.cwd(), "rpm-drinks-extracted.md");

describe("getItemAliases", () => {
  it("returns [] for an item with no curated aliases", () => {
    expect(getItemAliases("Some Item Nobody Mapped")).toEqual([]);
  });

  it("returns a fresh array each call (no shared-reference mutation risk)", () => {
    const a = getItemAliases("Coors Light");
    const b = getItemAliases("Coors Light");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  // The task's own named examples — regression guard against the alias map
  // losing these specific entries.
  it.each([
    ["Blackened Chicken BLT", "BLT"],
    ["Monster Reuben", "Reuben"],
    ["Foot Long Corndogs", "Corndog"],
  ])("includes %s -> %s", (name, expectedAlias) => {
    expect(getItemAliases(name)).toContain(expectedAlias);
  });

  it("includes the PRD §3.7 demo shorthand (\"we're out of Coors\")", () => {
    expect(getItemAliases("Coors Light")).toContain("Coors");
  });
});

describe("ITEM_ALIASES map shape", () => {
  const entries = Object.entries(ITEM_ALIASES);

  it("is non-empty", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it("has no empty/whitespace-only alias strings", () => {
    for (const [name, aliases] of entries) {
      for (const alias of aliases) {
        expect(alias.trim().length, `"${name}" has a blank alias`).toBeGreaterThan(0);
      }
    }
  });

  it("has no duplicate aliases within a single item's list", () => {
    for (const [name, aliases] of entries) {
      const unique = new Set(aliases);
      expect(unique.size, `"${name}" has duplicate aliases: ${aliases.join(", ")}`).toBe(aliases.length);
    }
  });

  it("never aliases an item to its own exact name (redundant no-op)", () => {
    for (const [name, aliases] of entries) {
      expect(aliases, `"${name}" aliases itself`).not.toContain(name);
    }
  });

  // Guards against a typo'd key silently becoming permanent dead weight (the
  // alias would just never attach to any item, with no error to notice).
  // Cross-checks every key against the *actual* parsed menu content, using
  // the same split/derivation rules import-menu.ts applies (eggroll split,
  // tea split, sides/pepsi comma lists) so this stays in sync with the real
  // import without duplicating importMenu()'s DB-writing logic.
  it("every alias key matches a real item name produced by the parsed menu", () => {
    const foodSections = parseFoodMenu(FOOD_MD);
    const drinks = parseDrinksMenu(DRINKS_MD);
    const sectionByName = new Map(foodSections.map((s) => [s.name, s]));

    const realNames = new Set<string>();

    const addFoodSectionNames = (sectionName: string, splitEggrolls = false) => {
      const section = sectionByName.get(sectionName);
      for (const it of section?.items ?? []) {
        if (splitEggrolls && it.name === "Southwestern or Philly Eggrolls") {
          realNames.add("Southwestern Eggrolls");
          realNames.add("Philly Eggrolls");
          continue;
        }
        realNames.add(it.name);
      }
    };
    addFoodSectionNames("Appetizers", true);
    addFoodSectionNames("Burgers");
    addFoodSectionNames("Sandwiches");
    addFoodSectionNames("Additional Sandwiches / Dogs");
    addFoodSectionNames("Salads");
    addFoodSectionNames("Desserts");

    for (const b of drinks.bottles) realNames.add(b.name);
    for (const c of drinks.cans) realNames.add(c.name);
    for (const w of drinks.drinkOfTheWeek) realNames.add(w.name);
    for (const d of drinks.draftBeer) realNames.add(d.name);

    const unmatched = Object.keys(ITEM_ALIASES).filter((key) => !realNames.has(key));
    expect(unmatched, `alias keys with no matching parsed item name: ${unmatched.join(", ")}`).toEqual([]);
  });
});
