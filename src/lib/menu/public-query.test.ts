import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { createCategory } from "@/lib/service/categories";
import { createTag } from "@/lib/service/tags";
import {
  createItem,
  setItemTags,
  createItemPriceVariant,
  setItemAvailability,
  setFeaturedSlot,
  archiveItem,
} from "@/lib/service/items";
import { updateMenuBehavior } from "@/lib/service/settings/menu-behavior";
import { updateBranding } from "@/lib/service/settings/branding";
import { updateVenueSettings } from "@/lib/service/settings/venue";
import type { ServiceCaller } from "@/lib/service/base";
import { getPublicMenu, buildMenuJsonLd, safeJsonLdString, tagTone } from "./public-query";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000ee" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

describe("public-query: getPublicMenu", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("renders a fixed-price item with its public tags, hides private tags", async () => {
    const category = await createCategory(db, owner, { name: "Sandwiches", type: "food" });
    const item = await createItem(db, owner, {
      name: "Monster Reuben",
      description: "Corned beef, kraut, swiss & thousand island on toasted marble rye.",
      priceCents: 1663,
      categoryId: category.id,
    });
    const publicTag = await createTag(db, owner, { name: "spicy", visibility: "public" });
    const privateTag = await createTag(db, owner, { name: "86-frequently", visibility: "private" });
    await setItemTags(db, owner, item.id, { tagIds: [publicTag.id, privateTag.id] });

    const menu = await getPublicMenu(db);
    const sandwiches = menu.categories.find((c) => c.name === "Sandwiches");
    expect(sandwiches).toBeDefined();
    const rendered = sandwiches!.items.find((i) => i.id === item.id)!;

    expect(rendered.price).toBe(16.63);
    expect(rendered.tags).toEqual([{ label: "spicy", tone: "spicy", dietUrl: undefined }]);
    expect(rendered.tags.some((t) => t.label === "86-frequently")).toBe(false);
  });

  it("renders ask_server items with an 'Ask your server' note and no price", async () => {
    const category = await createCategory(db, owner, { name: "Desserts", type: "food" });
    const item = await createItem(db, owner, {
      name: "Dessert of the Day",
      categoryId: category.id,
      pricingType: "ask_server",
    });

    const menu = await getPublicMenu(db);
    const rendered = menu.categories.find((c) => c.name === "Desserts")!.items.find((i) => i.id === item.id)!;

    expect(rendered.price).toBeUndefined();
    expect(rendered.note).toBe("Ask your server");
  });

  it("renders tbd items with no price and no note", async () => {
    const category = await createCategory(db, owner, { name: "Bottles & Cans", type: "drink" });
    const item = await createItem(db, owner, {
      name: "Pepsi",
      categoryId: category.id,
      pricingType: "tbd",
    });

    const menu = await getPublicMenu(db);
    const rendered = menu.categories
      .find((c) => c.name === "Bottles & Cans")!
      .items.find((i) => i.id === item.id)!;

    expect(rendered.price).toBeUndefined();
    expect(rendered.note).toBeUndefined();
  });

  it("lists other size price variants in the note, base price stays primary", async () => {
    const category = await createCategory(db, owner, { name: "Reubens", type: "food" });
    const item = await createItem(db, owner, {
      name: "Monster Reuben Full",
      priceCents: 1663,
      categoryId: category.id,
    });
    await createItemPriceVariant(db, owner, {
      itemId: item.id,
      label: "Half",
      priceCents: 1455,
      kind: "size",
    });

    const menu = await getPublicMenu(db);
    const rendered = menu.categories.find((c) => c.name === "Reubens")!.items.find((i) => i.id === item.id)!;

    expect(rendered.price).toBe(16.63);
    expect(rendered.note).toBe("Half 14.55");
  });

  it("excludes happy_hour price variants from the note", async () => {
    const category = await createCategory(db, owner, { name: "Draft Beer", type: "drink" });
    const item = await createItem(db, owner, { name: "House Lager", priceCents: 500, categoryId: category.id });
    await createItemPriceVariant(db, owner, {
      itemId: item.id,
      label: "Happy Hour",
      priceCents: 350,
      kind: "happy_hour",
    });

    const menu = await getPublicMenu(db);
    const rendered = menu.categories.find((c) => c.name === "Draft Beer")!.items.find((i) => i.id === item.id)!;

    expect(rendered.note).toBeUndefined();
  });

  it("respects the menu-behavior default (badge): unavailable items still render, dimmed", async () => {
    const category = await createCategory(db, owner, { name: "Wings", type: "food" });
    const item = await createItem(db, owner, { name: "Bone-In Wings", priceCents: 1299, categoryId: category.id });
    await setItemAvailability(db, owner, item.id, { isAvailable: false });

    const menu = await getPublicMenu(db);
    const rendered = menu.categories.find((c) => c.name === "Wings")!.items.find((i) => i.id === item.id)!;
    expect(rendered.isAvailable).toBe(false);
  });

  it("excludes archived items from the public menu regardless of availability or treatment", async () => {
    const category = await createCategory(db, owner, { name: "Retired", type: "food" });
    const kept = await createItem(db, owner, { name: "Still Served", priceCents: 900, categoryId: category.id });
    const archived = await createItem(db, owner, { name: "Discontinued Nachos", priceCents: 1100, categoryId: category.id });
    // Archived item stays available — proving archive, not availability, is
    // what drops it from the menu.
    await archiveItem(db, owner, archived.id);

    const menu = await getPublicMenu(db);
    const retired = menu.categories.find((c) => c.name === "Retired")!;
    expect(retired.items.some((i) => i.id === kept.id)).toBe(true);
    expect(retired.items.some((i) => i.id === archived.id)).toBe(false);
  });

  it("hides unavailable items entirely when menu behavior is set to 'hide'", async () => {
    await updateMenuBehavior(db, owner, { unavailableTreatment: "hide" });
    const category = await createCategory(db, owner, { name: "Sides", type: "food" });
    const item = await createItem(db, owner, { name: "O-Rings", priceCents: 599, categoryId: category.id });
    await setItemAvailability(db, owner, item.id, { isAvailable: false });

    const menu = await getPublicMenu(db);
    const sides = menu.categories.find((c) => c.name === "Sides");
    // Category renders only if it has visible items — with the sole item
    // hidden, the whole section should be absent.
    expect(sides).toBeUndefined();

    // restore default for subsequent tests in this file
    await updateMenuBehavior(db, owner, { unavailableTreatment: "badge" });
  });

  it("omits public tags entirely when showPublicTagBadges is off", async () => {
    const category = await createCategory(db, owner, { name: "Drinks", type: "drink" });
    const item = await createItem(db, owner, { name: "House IPA", priceCents: 700, categoryId: category.id });
    const tag = await createTag(db, owner, { name: "new", visibility: "public" });
    await setItemTags(db, owner, item.id, { tagIds: [tag.id] });

    await updateMenuBehavior(db, owner, { showPublicTagBadges: false });
    const menu = await getPublicMenu(db);
    const rendered = menu.categories.find((c) => c.name === "Drinks")!.items.find((i) => i.id === item.id)!;
    expect(rendered.tags).toEqual([]);

    await updateMenuBehavior(db, owner, { showPublicTagBadges: true });
  });

  it("omits images entirely when showImages is off", async () => {
    await updateMenuBehavior(db, owner, { showImages: false });
    const menu = await getPublicMenu(db);
    expect(menu.venue.logoUrl).toBeNull();
    for (const category of menu.categories) {
      expect(category.imageUrl).toBeNull();
      for (const item of category.items) expect(item.imageUrl).toBeNull();
    }
    await updateMenuBehavior(db, owner, { showImages: true });
  });

  it("falls back to '<venue name> Menu' when no custom SEO title is set", async () => {
    const menu = await getPublicMenu(db);
    expect(menu.seo.title.endsWith("Menu")).toBe(true);
  });

  it("uses the configured SEO title/description when set", async () => {
    await updateMenuBehavior(db, owner, { seoTitle: "RPM Pub Menu", seoDescription: "Dive bar eats & drinks." });
    const menu = await getPublicMenu(db);
    expect(menu.seo.title).toBe("RPM Pub Menu");
    expect(menu.seo.description).toBe("Dive bar eats & drinks.");
  });

  it("exposes branding color/font overrides as CSS custom properties", async () => {
    await updateBranding(db, owner, { primaryColor: "#112233", accentColor: "#445566", font: "anton" });
    const menu = await getPublicMenu(db);
    expect(menu.venue.cssVars["--accent-primary"]).toBe("#112233");
    expect(menu.venue.cssVars["--accent-secondary"]).toBe("#445566");
    expect(menu.venue.cssVars["--font-display"]).toContain("Anton");
  });

  it("applies venue currencyFormat.showTrailingZeros.web to variant notes", async () => {
    await updateVenueSettings(db, owner, { currencyFormat: { showTrailingZeros: { web: false } } });
    const category = await createCategory(db, owner, { name: "Baskets", type: "food" });
    const item = await createItem(db, owner, { name: "Basket Combo", priceCents: 1000, categoryId: category.id });
    await createItemPriceVariant(db, owner, { itemId: item.id, label: "Large", priceCents: 1200, kind: "size" });

    const menu = await getPublicMenu(db);
    const rendered = menu.categories.find((c) => c.name === "Baskets")!.items.find((i) => i.id === item.id)!;
    expect(rendered.note).toBe("Large 12");

    await updateVenueSettings(db, owner, { currencyFormat: { showTrailingZeros: { web: true } } });
  });

  it("skips an empty category (zero items) from the public output", async () => {
    await createCategory(db, owner, { name: "Empty Section", type: "food" });
    const menu = await getPublicMenu(db);
    expect(menu.categories.some((c) => c.name === "Empty Section")).toBe(false);
  });

  it("sorts categories/items by sortOrder", async () => {
    const category = await createCategory(db, owner, { name: "Ordering Test", type: "food" });
    const second = await createItem(db, owner, {
      name: "Second",
      priceCents: 100,
      categoryId: category.id,
      sortOrder: 2,
    });
    const first = await createItem(db, owner, {
      name: "First",
      priceCents: 100,
      categoryId: category.id,
      sortOrder: 1,
    });

    const menu = await getPublicMenu(db);
    const ordered = menu.categories.find((c) => c.name === "Ordering Test")!.items.map((i) => i.id);
    expect(ordered).toEqual([first.id, second.id]);
  });

  it("marks a featured-slot item and derives a readable label", async () => {
    const category = await createCategory(db, owner, { name: "Featured", type: "drink" });
    const item = await createItem(db, owner, { name: "The Ginny Runner", priceCents: 900, categoryId: category.id });
    await setFeaturedSlot(db, owner, item.id, { featuredSlotKey: "drink_of_the_week" });

    const menu = await getPublicMenu(db);
    const rendered = menu.categories.find((c) => c.name === "Featured")!.items.find((i) => i.id === item.id)!;
    expect(rendered.featuredSlotKey).toBe("drink_of_the_week");
    expect(rendered.featuredLabel).toBe("Drink Of The Week");
  });

  it("uses a category's own display_config to gate attribute/description/badge rendering", async () => {
    const category = await createCategory(db, owner, {
      name: "Draft",
      type: "drink",
      displayConfig: { attributeOrder: ["abv"], showDescription: { web: false, display: false }, showBadges: false },
    });
    const item = await createItem(db, owner, {
      name: "Hefeweizen",
      priceCents: 600,
      categoryId: category.id,
      description: "Banana & clove notes.",
      attributes: { abv: 5.4 },
    });
    const tag = await createTag(db, owner, { name: "seasonal", visibility: "public" });
    await setItemTags(db, owner, item.id, { tagIds: [tag.id] });

    const menu = await getPublicMenu(db);
    const rendered = menu.categories.find((c) => c.name === "Draft")!.items.find((i) => i.id === item.id)!;
    expect(rendered.attributeLine).toBe("5.4% ABV");
    expect(rendered.description).toBeNull(); // showDescription.web = false
    expect(rendered.tags).toEqual([]); // showBadges = false at the category level
  });
});

describe("public-query: tagTone", () => {
  it("maps seed public tags to design-system tones, defaulting unknown tags to 'default'", () => {
    expect(tagTone("spicy")).toBe("spicy");
    expect(tagTone("vegan")).toBe("veggie");
    expect(tagTone("vegetarian")).toBe("veggie");
    expect(tagTone("new")).toBe("new");
    expect(tagTone("house-favorite")).toBe("fave");
    expect(tagTone("gluten-free")).toBe("default");
    expect(tagTone("non-alcoholic")).toBe("default");
  });
});

describe("public-query: buildMenuJsonLd", () => {
  it("builds schema.org Menu markup, omitting offers for unpriced items and including diet mappings", () => {
    const jsonLd = buildMenuJsonLd(
      {
        venue: { name: "RPM Pub", logoUrl: null, address: null, phone: null, social: {}, hours: {}, cssVars: {} },
        seo: { title: "RPM Pub Menu", description: "Dive bar eats." },
        categories: [
          {
            id: "cat-1",
            name: "Drinks",
            type: "drink",
            tagline: null,
            imageUrl: null,
            items: [
              {
                id: "item-1",
                name: "House IPA",
                description: "Hoppy.",
                attributeLine: null,
                price: 7,
                note: undefined,
                isAvailable: true,
                imageUrl: null,
                imageDisplayUrl: null,
                gallery: [],
                tags: [{ label: "vegan", tone: "veggie", dietUrl: "https://schema.org/VeganDiet" }],
                featuredSlotKey: null,
                featuredLabel: null,
              },
              {
                id: "item-2",
                name: "Pepsi",
                description: null,
                attributeLine: null,
                price: undefined,
                note: undefined,
                isAvailable: true,
                imageUrl: null,
                imageDisplayUrl: null,
                gallery: [],
                tags: [],
                featuredSlotKey: null,
                featuredLabel: null,
              },
            ],
          },
        ],
      },
      "https://example.com/menu",
    );

    expect(jsonLd["@type"]).toBe("Menu");
    expect(jsonLd.url).toBe("https://example.com/menu");
    const section = (jsonLd.hasMenuSection as Record<string, unknown>[])[0];
    const menuItems = section.hasMenuItem as Record<string, unknown>[];
    expect(menuItems[0].offers).toEqual({ "@type": "Offer", price: "7.00", priceCurrency: "USD" });
    expect(menuItems[0].suitableForDiet).toEqual(["https://schema.org/VeganDiet"]);
    expect(menuItems[1].offers).toBeUndefined();
  });
});

describe("public-query: safeJsonLdString", () => {
  it("escapes </script> so an admin/staff-authored string can't break out of the inline <script> tag", () => {
    const malicious = "Test</script><script>alert(document.cookie)</script>";
    const serialized = safeJsonLdString({ name: malicious });

    // The dangerous literal must never appear verbatim in the output.
    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script>");
    // But the escaped form must still round-trip to the exact same value --
    // this is an encoding change, not a data change.
    expect(JSON.parse(serialized)).toEqual({ name: malicious });
  });

  it("produces ordinary output for a string with no special characters", () => {
    const serialized = safeJsonLdString({ name: "House IPA" });
    expect(JSON.parse(serialized)).toEqual({ name: "House IPA" });
  });
});
