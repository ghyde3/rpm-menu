import { describe, expect, it } from "vitest";
import type { Item } from "@/db/schema";
import { parseItemsQuery, filterAndPageItems } from "./items-query";

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: overrides.id ?? "00000000-0000-0000-0000-000000000001",
    name: "Item",
    description: null,
    priceCents: 500,
    pricingType: "fixed",
    categoryId: "cat-1",
    isAvailable: true,
    sortOrder: 0,
    imageId: null,
    aliases: [],
    attributes: {},
    featuredSlotKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Item;
}

describe("parseItemsQuery", () => {
  it("applies defaults when no params are given", () => {
    const parsed = parseItemsQuery(new URLSearchParams());
    expect(parsed).toMatchObject({ limit: 50, offset: 0 });
    expect(parsed.q).toBeUndefined();
    expect(parsed.isAvailable).toBeUndefined();
  });

  it("clamps limit to the 1..200 range, falling back to the default for 0/invalid input", () => {
    expect(parseItemsQuery(new URLSearchParams("limit=0")).limit).toBe(50);
    expect(parseItemsQuery(new URLSearchParams("limit=9999")).limit).toBe(200);
    expect(parseItemsQuery(new URLSearchParams("limit=25")).limit).toBe(25);
  });

  it("floors offset at 0", () => {
    expect(parseItemsQuery(new URLSearchParams("offset=-5")).offset).toBe(0);
    expect(parseItemsQuery(new URLSearchParams("offset=10")).offset).toBe(10);
  });

  it("parses isAvailable as a tri-state (unset / true / false)", () => {
    expect(parseItemsQuery(new URLSearchParams()).isAvailable).toBeUndefined();
    expect(parseItemsQuery(new URLSearchParams("isAvailable=true")).isAvailable).toBe(true);
    expect(parseItemsQuery(new URLSearchParams("isAvailable=false")).isAvailable).toBe(false);
  });

  it("trims q and drops empty string filters", () => {
    expect(parseItemsQuery(new URLSearchParams("q=  burger  ")).q).toBe("burger");
    expect(parseItemsQuery(new URLSearchParams("q=")).q).toBeUndefined();
  });
});

describe("filterAndPageItems", () => {
  const items = [
    makeItem({ id: "1", name: "Cheeseburger", categoryId: "food", isAvailable: true, pricingType: "fixed" }),
    makeItem({ id: "2", name: "House Lager", categoryId: "drink", isAvailable: false, pricingType: "fixed" }),
    makeItem({
      id: "3",
      name: "Dessert of the Day",
      description: "Ask your server",
      categoryId: "food",
      isAvailable: true,
      priceCents: null,
      pricingType: "ask_server",
    }),
  ];

  it("returns everything unfiltered, paged", () => {
    const { items: page, total } = filterAndPageItems(items, {
      limit: 50,
      offset: 0,
    });
    expect(total).toBe(3);
    expect(page).toHaveLength(3);
  });

  it("filters by name/description substring, case-insensitively", () => {
    const { items: page, total } = filterAndPageItems(items, { q: "burger", limit: 50, offset: 0 });
    expect(total).toBe(1);
    expect(page[0].id).toBe("1");

    const byDescription = filterAndPageItems(items, { q: "ask your server", limit: 50, offset: 0 });
    expect(byDescription.total).toBe(1);
    expect(byDescription.items[0].id).toBe("3");
  });

  it("filters by categoryId", () => {
    const { items: page, total } = filterAndPageItems(items, { categoryId: "drink", limit: 50, offset: 0 });
    expect(total).toBe(1);
    expect(page[0].id).toBe("2");
  });

  it("filters by isAvailable", () => {
    const { total } = filterAndPageItems(items, { isAvailable: false, limit: 50, offset: 0 });
    expect(total).toBe(1);
  });

  it("filters by pricingType", () => {
    const { total, items: page } = filterAndPageItems(items, { pricingType: "ask_server", limit: 50, offset: 0 });
    expect(total).toBe(1);
    expect(page[0].id).toBe("3");
  });

  it("filters by tag membership via itemIdsWithTag", () => {
    const { total, items: page } = filterAndPageItems(items, {
      tagId: "spicy",
      itemIdsWithTag: new Set(["1"]),
      limit: 50,
      offset: 0,
    });
    expect(total).toBe(1);
    expect(page[0].id).toBe("1");
  });

  it("ignores tagId when itemIdsWithTag is empty (no matches, not a no-op)", () => {
    const { total } = filterAndPageItems(items, { tagId: "spicy", limit: 50, offset: 0 });
    expect(total).toBe(0);
  });

  it("pages results after filtering", () => {
    const { items: page, total } = filterAndPageItems(items, { limit: 1, offset: 1 });
    expect(total).toBe(3);
    expect(page).toHaveLength(1);
    expect(page[0].id).toBe("2");
  });

  it("combines multiple filters (AND semantics)", () => {
    const { total } = filterAndPageItems(items, { categoryId: "food", isAvailable: true, limit: 50, offset: 0 });
    expect(total).toBe(2);
  });
});
