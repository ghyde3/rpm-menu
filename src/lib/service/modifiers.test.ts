import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories } from "@/db/schema";
import { createItem } from "./items";
import {
  createModifierGroup,
  createModifierOption,
  resolveModifierOptionPricing,
  createModifierGroupAttachment,
  setItemModifierOptionExclusions,
} from "./modifiers";
import type { ServiceCaller } from "./base";
import { resolveOptionPrice, formatOptionPrice } from "@/lib/pricing";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000cc" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

describe("modifiers service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("creates an ambiguous option that the pricing lib refuses to resolve, then resolves it via the two explicit buttons", async () => {
    const group = await createModifierGroup(db, owner, { name: "Sandwich subs", selectionType: "multiple" });
    const option = await createModifierOption(db, owner, {
      groupId: group.id,
      label: "Sub grilled salmon",
      pricingMode: "ambiguous",
      rawPriceText: "$10.63",
    });

    expect(
      resolveOptionPrice({
        pricingMode: option.pricingMode,
        priceDeltaCents: option.priceDeltaCents,
        replacementPriceCents: option.replacementPriceCents,
      }),
    ).toEqual({ cents: null, kind: null, needsReview: true });
    expect(
      formatOptionPrice({
        pricingMode: option.pricingMode,
        priceDeltaCents: option.priceDeltaCents,
        replacementPriceCents: option.replacementPriceCents,
      }),
    ).toBeNull();

    const resolved = await resolveModifierOptionPricing(db, owner, option.id, {
      mode: "delta",
      priceDeltaCents: 1063,
    });
    expect(resolved.pricingMode).toBe("delta");
    expect(resolved.priceDeltaCents).toBe(1063);
    expect(
      formatOptionPrice({
        pricingMode: resolved.pricingMode,
        priceDeltaCents: resolved.priceDeltaCents,
        replacementPriceCents: resolved.replacementPriceCents,
      }),
    ).toBe("$10.63");
  });

  it("attaches a group to a category (fan-out) and to a single item, enforcing exactly one of the two", async () => {
    const group = await createModifierGroup(db, owner, { name: "Burger Defaults", selectionType: "multiple" });
    const [category] = await db.insert(categories).values({ name: "Burgers", type: "food" }).returning();

    const attachment = await createModifierGroupAttachment(db, owner, {
      groupId: group.id,
      categoryId: category.id,
    });
    expect(attachment.categoryId).toBe(category.id);
    expect(attachment.itemId).toBeNull();

    await expect(
      createModifierGroupAttachment(db, owner, {
        groupId: group.id,
        itemId: "00000000-0000-0000-0000-000000000001",
        categoryId: category.id,
      }),
    ).rejects.toThrow();
  });

  it("replaces an item's excluded-option set in one call", async () => {
    const [category] = await db.insert(categories).values({ name: "Burgers 2", type: "food" }).returning();
    const item = await createItem(db, owner, { name: "Double Burger", categoryId: category.id });
    const group = await createModifierGroup(db, owner, { name: "Burger Add-ons", selectionType: "multiple" });
    const patty = await createModifierOption(db, owner, {
      groupId: group.id,
      label: "Add ½ lb patty",
      pricingMode: "ambiguous",
    });

    const result = await setItemModifierOptionExclusions(db, owner, item.id, { optionIds: [patty.id] });
    expect(result).toEqual([patty.id]);

    const cleared = await setItemModifierOptionExclusions(db, owner, item.id, { optionIds: [] });
    expect(cleared).toEqual([]);
  });

  it("rejects an unauthorized (staff-role-missing) caller", async () => {
    const anon: ServiceCaller = { actor: { type: "user", id: null }, surface: "admin_ui" };
    await expect(
      createModifierGroup(db, anon, { name: "x", selectionType: "single" }),
    ).rejects.toThrow();
  });
});
