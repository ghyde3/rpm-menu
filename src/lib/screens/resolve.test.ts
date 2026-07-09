import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { categories, items, itemTags, tags, itemPriceVariants } from "@/db/schema";
import { createScreen, setScreenItems, updateScreen } from "@/lib/service/screens";
import { resolveScreenContent } from "./resolve";
import type { ServiceCaller } from "@/lib/service/base";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000aa" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

describe("resolveScreenContent", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("query mode: matches items by category OR tag (union), respects orderBy", async () => {
    const [draftCat] = await db.insert(categories).values({ name: "Draft", type: "drink" }).returning();
    const [bottleCat] = await db.insert(categories).values({ name: "Bottles", type: "drink" }).returning();
    const [specialTag] = await db.insert(tags).values({ name: "special", visibility: "private" }).returning();

    await db.insert(items).values({ name: "Lager", categoryId: draftCat.id, priceCents: 600, sortOrder: 2 });
    await db.insert(items).values({ name: "IPA", categoryId: draftCat.id, priceCents: 700, sortOrder: 1 });
    const [specialBottle] = await db
      .insert(items)
      .values({ name: "Special Bottle", categoryId: bottleCat.id, priceCents: 900 })
      .returning();
    // Unrelated bottle, not matched by category or tag.
    await db.insert(items).values({ name: "Unrelated Bottle", categoryId: bottleCat.id, priceCents: 500 });

    await db.insert(itemTags).values({ itemId: specialBottle.id, tagId: specialTag.id });

    const screen = await createScreen(db, owner, {
      name: "Draft + Specials",
      sourceMode: "query",
      sourceConfig: { categoryIds: [draftCat.id], tagIds: [specialTag.id] },
    });

    const resolved = await resolveScreenContent(db, screen.id);
    const names = resolved.items.map((i) => i.name).sort();
    expect(names).toEqual(["IPA", "Lager", "Special Bottle"].sort());
    expect(names).not.toContain("Unrelated Bottle");

    // Default orderBy = sort_order: IPA (1) before Lager (2). Special Bottle
    // (sortOrder 0 default) sorts before both by sort_order, so re-check with
    // orderBy=name for a deterministic, easy-to-read assertion instead.
    const byName = await updateScreen(db, owner, screen.id, {
      sourceConfig: { categoryIds: [draftCat.id], tagIds: [specialTag.id], orderBy: "name" },
    });
    const resolvedByName = await resolveScreenContent(db, byName.id);
    expect(resolvedByName.items.map((i) => i.name)).toEqual(["IPA", "Lager", "Special Bottle"]);
  });

  it("manual mode: preserves the curated item order regardless of sort_order/name", async () => {
    const [cat] = await db.insert(categories).values({ name: "Sandwiches", type: "food" }).returning();
    const [reuben] = await db.insert(items).values({ name: "Reuben", categoryId: cat.id, priceCents: 1200 }).returning();
    const [blt] = await db.insert(items).values({ name: "BLT", categoryId: cat.id, priceCents: 1000 }).returning();

    const screen = await createScreen(db, owner, { name: "Manual Curated", sourceMode: "manual" });
    await setScreenItems(db, owner, screen.id, { itemIds: [reuben.id, blt.id] });

    const resolved = await resolveScreenContent(db, screen.id);
    expect(resolved.items.map((i) => i.name)).toEqual(["Reuben", "BLT"]);
  });

  it("unavailable-item treatment: hides by default, badges (dims, doesn't remove) when set to 'badge'", async () => {
    const [cat] = await db.insert(categories).values({ name: "Apps", type: "food" }).returning();
    const [available] = await db
      .insert(items)
      .values({ name: "Available Item", categoryId: cat.id, priceCents: 500, isAvailable: true })
      .returning();
    const [unavailable] = await db
      .insert(items)
      .values({ name: "86'd Item", categoryId: cat.id, priceCents: 500, isAvailable: false })
      .returning();

    const screen = await createScreen(db, owner, {
      name: "Apps Screen",
      sourceMode: "query",
      sourceConfig: { categoryIds: [cat.id] },
    });

    const hidden = await resolveScreenContent(db, screen.id);
    expect(hidden.items.map((i) => i.id)).toEqual([available.id]);

    await updateScreen(db, owner, screen.id, { displayOptions: { unavailableTreatment: "badge" } });
    const badged = await resolveScreenContent(db, screen.id);
    expect(badged.items.map((i) => i.id).sort()).toEqual([available.id, unavailable.id].sort());
    const badgedItem = badged.items.find((i) => i.id === unavailable.id)!;
    expect(badgedItem.isAvailable).toBe(false);
  });

  it("prefers the kind='happy_hour' price variant when price_mode='happy_hour', falling back otherwise", async () => {
    const [cat] = await db.insert(categories).values({ name: "Cocktails", type: "drink" }).returning();
    const [withHH] = await db
      .insert(items)
      .values({ name: "Old Fashioned", categoryId: cat.id, priceCents: 1200 })
      .returning();
    const [withoutHH] = await db
      .insert(items)
      .values({ name: "Margarita", categoryId: cat.id, priceCents: 1100 })
      .returning();
    await db.insert(itemPriceVariants).values({ itemId: withHH.id, label: "Happy Hour", priceCents: 700, kind: "happy_hour" });

    const screen = await createScreen(db, owner, {
      name: "Happy Hour Screen",
      sourceMode: "query",
      sourceConfig: { categoryIds: [cat.id] },
      displayOptions: { priceMode: "happy_hour" },
    });

    const resolved = await resolveScreenContent(db, screen.id);
    const oldFashioned = resolved.items.find((i) => i.id === withHH.id)!;
    expect(oldFashioned.price).toBe("$7.00");
    expect(oldFashioned.priceNote).toBe("Happy Hour");

    const margarita = resolved.items.find((i) => i.id === withoutHH.id)!;
    expect(margarita.price).toBe("$11.00");
    expect(margarita.priceNote).toBeNull();
  });

  it("joins size variants into a priceNote when price_mode is standard", async () => {
    const [cat] = await db.insert(categories).values({ name: "Sandwiches 2", type: "food" }).returning();
    const [item] = await db
      .insert(items)
      .values({ name: "Monster Reuben", categoryId: cat.id, priceCents: 1663 })
      .returning();
    await db.insert(itemPriceVariants).values([
      { itemId: item.id, label: "Full", priceCents: 1663, kind: "size", sortOrder: 0 },
      { itemId: item.id, label: "Half", priceCents: 1455, kind: "size", sortOrder: 1 },
    ]);

    const screen = await createScreen(db, owner, {
      name: "Sandwich Screen",
      sourceMode: "query",
      sourceConfig: { categoryIds: [cat.id] },
    });

    const resolved = await resolveScreenContent(db, screen.id);
    const resolvedItem = resolved.items.find((i) => i.id === item.id)!;
    expect(resolvedItem.priceNote).toBe("Full $16.63 · Half $14.55");
  });

  it("renders ask_server/tbd pricingType with no price, and an ask-server note", async () => {
    const [cat] = await db.insert(categories).values({ name: "Desserts", type: "food" }).returning();
    const [dessert] = await db
      .insert(items)
      .values({ name: "Dessert of the Day", categoryId: cat.id, priceCents: null, pricingType: "ask_server" })
      .returning();
    const [tbdDrink] = await db
      .insert(items)
      .values({ name: "Mystery Soda", categoryId: cat.id, priceCents: null, pricingType: "tbd" })
      .returning();

    const screen = await createScreen(db, owner, {
      name: "Desserts Screen",
      sourceMode: "query",
      sourceConfig: { categoryIds: [cat.id] },
    });

    const resolved = await resolveScreenContent(db, screen.id);
    const resolvedDessert = resolved.items.find((i) => i.id === dessert.id)!;
    expect(resolvedDessert.price).toBeNull();
    expect(resolvedDessert.priceNote).toBe("Ask your server");

    const resolvedTbd = resolved.items.find((i) => i.id === tbdDrink.id)!;
    expect(resolvedTbd.price).toBeNull();
    expect(resolvedTbd.priceNote).toBeNull();
  });

  it("only renders public tags as badges, never private tags, and respects the showBadges knob", async () => {
    const [cat] = await db.insert(categories).values({ name: "Wings", type: "food" }).returning();
    const [item] = await db.insert(items).values({ name: "Buffalo Wings", categoryId: cat.id, priceCents: 1200 }).returning();
    const [spicyTag] = await db.insert(tags).values({ name: "spicy", visibility: "public" }).returning();
    const [internalTag] = await db.insert(tags).values({ name: "domestic", visibility: "private" }).returning();
    await db.insert(itemTags).values([
      { itemId: item.id, tagId: spicyTag.id },
      { itemId: item.id, tagId: internalTag.id },
    ]);

    const screen = await createScreen(db, owner, {
      name: "Wings Screen",
      sourceMode: "query",
      sourceConfig: { categoryIds: [cat.id] },
    });

    const resolved = await resolveScreenContent(db, screen.id);
    const resolvedItem = resolved.items.find((i) => i.id === item.id)!;
    expect(resolvedItem.tags).toEqual([{ label: "spicy", tone: "spicy" }]);

    await updateScreen(db, owner, screen.id, { displayOptions: { showBadges: false } });
    const badgesOff = await resolveScreenContent(db, screen.id);
    expect(badgesOff.items.find((i) => i.id === item.id)!.tags).toEqual([]);
  });

  it("uses display_options.title override, else falls back to the screen name", async () => {
    const screen = await createScreen(db, owner, { name: "Fallback Name", sourceMode: "manual" });
    const resolved = await resolveScreenContent(db, screen.id);
    expect(resolved.title).toBe("Fallback Name");

    await updateScreen(db, owner, screen.id, { displayOptions: { title: "Custom Title" } });
    const resolvedWithTitle = await resolveScreenContent(db, screen.id);
    expect(resolvedWithTitle.title).toBe("Custom Title");
  });

  it("returns no items for a query-mode screen with no tagIds/categoryIds configured", async () => {
    const screen = await createScreen(db, owner, { name: "Unconfigured Query Screen", sourceMode: "query" });
    const resolved = await resolveScreenContent(db, screen.id);
    expect(resolved.items).toEqual([]);
  });
});
