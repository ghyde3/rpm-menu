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
  listModifierGroupsWithSummary,
  getModifierGroupDetail,
  previewCategoryAttachment,
  getItemModifierView,
  listOptionsNeedingPricingReview,
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

  describe("composed read views", () => {
    it("summarizes groups with option/attachment counts, batched (no N+1)", async () => {
      const group = await createModifierGroup(db, owner, { name: "Wing Sauce Choice", selectionType: "single" });
      await createModifierOption(db, owner, { groupId: group.id, label: "Mild", pricingMode: "included" });
      await createModifierOption(db, owner, { groupId: group.id, label: "Hot", pricingMode: "included" });
      const [category] = await db.insert(categories).values({ name: "Wings", type: "food" }).returning();
      await createModifierGroupAttachment(db, owner, { groupId: group.id, categoryId: category.id });

      const summaries = await listModifierGroupsWithSummary(db);
      const summary = summaries.find((s) => s.id === group.id);
      expect(summary?.optionCount).toBe(2);
      expect(summary?.attachmentCount).toBe(1);
    });

    it("resolves a group's attachments to human-readable item/category names", async () => {
      const group = await createModifierGroup(db, owner, { name: "Burger Add-ons 2", selectionType: "multiple" });
      const [category] = await db.insert(categories).values({ name: "Burgers 3", type: "food" }).returning();
      const item = await createItem(db, owner, { name: "Veggie Wrap", categoryId: category.id });
      await createModifierGroupAttachment(db, owner, { groupId: group.id, categoryId: category.id });
      await createModifierGroupAttachment(db, owner, { groupId: group.id, itemId: item.id });

      const detail = await getModifierGroupDetail(db, group.id);
      expect(detail.attachments).toHaveLength(2);
      const categoryAttachment = detail.attachments.find((a) => a.categoryId === category.id);
      const itemAttachment = detail.attachments.find((a) => a.itemId === item.id);
      expect(categoryAttachment?.categoryName).toBe("Burgers 3");
      expect(itemAttachment?.itemName).toBe("Veggie Wrap");
    });

    it("previews category fan-out ('applies to N items') from live category membership", async () => {
      const [category] = await db.insert(categories).values({ name: "Sides", type: "food" }).returning();
      await createItem(db, owner, { name: "Fries", categoryId: category.id });
      await createItem(db, owner, { name: "Slaw", categoryId: category.id });

      const preview = await previewCategoryAttachment(db, category.id);
      expect(preview.count).toBe(2);
      expect(preview.sampleItems.map((i) => i.name)).toEqual(expect.arrayContaining(["Fries", "Slaw"]));
    });

    it("resolves an item's applicable groups from both direct and category-level (inherited) attachments, honoring per-item exclusions", async () => {
      const [category] = await db.insert(categories).values({ name: "Burgers 4", type: "food" }).returning();
      const item = await createItem(db, owner, { name: "Double Burger 2", categoryId: category.id });

      const categoryGroup = await createModifierGroup(db, owner, { name: "Burger Defaults 2", selectionType: "multiple" });
      const pattyOption = await createModifierOption(db, owner, {
        groupId: categoryGroup.id,
        label: "Add ½ lb patty",
        pricingMode: "included",
      });
      await createModifierGroupAttachment(db, owner, { groupId: categoryGroup.id, categoryId: category.id });

      const itemGroup = await createModifierGroup(db, owner, { name: "Item-only Add-ons", selectionType: "multiple" });
      await createModifierOption(db, owner, { groupId: itemGroup.id, label: "Extra napkins", pricingMode: "included" });
      await createModifierGroupAttachment(db, owner, { groupId: itemGroup.id, itemId: item.id });

      // Before exclusion: the inherited option is present and not excluded.
      const before = await getItemModifierView(db, item.id);
      expect(before.groups).toHaveLength(2);
      const inheritedBefore = before.groups.find((g) => g.group.id === categoryGroup.id);
      expect(inheritedBefore?.source).toBe("category");
      expect(inheritedBefore?.options.find((o) => o.option.id === pattyOption.id)?.excluded).toBe(false);
      const directBefore = before.groups.find((g) => g.group.id === itemGroup.id);
      expect(directBefore?.source).toBe("item");

      // After excluding the patty option for this item only.
      await setItemModifierOptionExclusions(db, owner, item.id, { optionIds: [pattyOption.id] });
      const after = await getItemModifierView(db, item.id);
      const inheritedAfter = after.groups.find((g) => g.group.id === categoryGroup.id);
      expect(inheritedAfter?.options.find((o) => o.option.id === pattyOption.id)?.excluded).toBe(true);
    });

    it("lists ambiguous options needing pricing review with their affected items (direct + category fan-out)", async () => {
      const [category] = await db.insert(categories).values({ name: "Sandwiches 2", type: "food" }).returning();
      const item = await createItem(db, owner, { name: "BLT", categoryId: category.id });

      const group = await createModifierGroup(db, owner, { name: "Sandwich subs 2", selectionType: "multiple" });
      const option = await createModifierOption(db, owner, {
        groupId: group.id,
        label: "Sub grilled salmon 2",
        pricingMode: "ambiguous",
        rawPriceText: "$10.63",
      });
      await createModifierGroupAttachment(db, owner, { groupId: group.id, itemId: item.id });

      const review = await listOptionsNeedingPricingReview(db);
      const entry = review.find((e) => e.option.id === option.id);
      expect(entry).toBeDefined();
      expect(entry?.group.id).toBe(group.id);
      expect(entry?.affectedItems.map((i) => i.id)).toContain(item.id);

      // Resolving the option removes it from the review list.
      await resolveModifierOptionPricing(db, owner, option.id, { mode: "delta", priceDeltaCents: 1063 });
      const reviewAfter = await listOptionsNeedingPricingReview(db);
      expect(reviewAfter.find((e) => e.option.id === option.id)).toBeUndefined();
    });
  });
});
