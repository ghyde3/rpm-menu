// Loads the full real menu through the service layer (PRD §3.7's "same
// service functions as the admin UI" contract applies to seeding too — no
// direct table writes for menu content). Every mutation runs as
// actor_type=system / surface=system so the audit log records exactly who
// (the seed script) created every row, same as any other automated import.
//
// Source of truth: the two *.md files, parsed at runtime by parse-food.ts /
// parse-drinks.ts. This module is the "owner-confirmed content decisions"
// layer — it interprets prose into structured rows, but every price/label it
// uses is extracted from the parsed text (see extract.ts), never hand-typed.
import { eq, sql, and } from "drizzle-orm";
import path from "node:path";
import type { Database } from "@/db";
import {
  items,
  modifierOptions,
  venueSettings,
  VENUE_SETTINGS_ID,
  type CategoryType,
} from "@/db/schema";
import type { ServiceCaller } from "@/lib/service/base";
import { createCategory } from "@/lib/service/categories";
import { createTag } from "@/lib/service/tags";
import { createItem, setItemTags, setFeaturedSlot, createItemPriceVariant } from "@/lib/service/items";
import {
  createModifierGroup,
  createModifierOption,
  resolveModifierOptionPricing,
  createModifierGroupAttachment,
} from "@/lib/service/modifiers";
import { parseFoodMenu, type ParsedFoodItem, type ParsedFoodSection } from "./parse-food";
import { parseDrinksMenu } from "./parse-drinks";
import { extractCents, splitChoiceList, titleCase } from "./extract";
import { getItemAliases } from "./aliases";

const FOOD_MD = path.resolve(process.cwd(), "rpm-menu-extracted.md");
const DRINKS_MD = path.resolve(process.cwd(), "rpm-drinks-extracted.md");

const SYSTEM_CALLER: ServiceCaller = { actor: { type: "system", id: null }, surface: "system" };

/** PRD §3.1 seed sets, plus "non-alcoholic" — addendum §3's GF/N-A drinks row
 * names both "gluten-free" and "non-alcoholic" as public tags, but the PRD
 * §3.1 seed list only wrote out "gluten-free". Adding "non-alcoholic" here
 * (recorded as a deviation) so Premier N/A / Bud N/A have a tag to carry. */
const PUBLIC_TAGS = ["spicy", "vegan", "vegetarian", "gluten-free", "new", "house-favorite", "non-alcoholic"] as const;
const PRIVATE_TAGS = ["domestic", "import", "draft", "bottle", "can", "special", "happy-hour-eligible"] as const;

function normalizeName(name: string): string {
  // "Mic Ultra" -> "Mich Ultra" (owner-confirmed 2026-07-09). Source files
  // already spell it correctly, but this stays as a defensive normalization
  // in case a future re-extraction reintroduces the typo.
  return name.replace(/\bMic Ultra\b/g, "Mich Ultra");
}

function normalizeDescription(desc: string | null): string | null {
  if (desc === null) return null;
  // "japs" -> "jalapeños" (owner-confirmed 2026-07-09).
  return desc.replace(/\bjaps\b/gi, "jalapeños");
}

async function getOrCreateOptionWithDelta(
  db: Database,
  groupId: string,
  label: string,
  deltaCents: number,
  sortOrder: number,
): Promise<string> {
  const created = await createModifierOption(db, SYSTEM_CALLER, {
    groupId,
    label,
    pricingMode: "ambiguous",
    rawPriceText: `$${(deltaCents / 100).toFixed(2)}`,
    sortOrder,
  });
  // The addendum's fail-safe: delta/replacement pricing is only ever set via
  // this explicit second call, never as a raw field alongside creation.
  const resolved = await resolveModifierOptionPricing(db, SYSTEM_CALLER, created.id, {
    mode: "delta",
    priceDeltaCents: deltaCents,
  });
  return resolved.id;
}

async function createIncludedOption(
  db: Database,
  groupId: string,
  label: string,
  sortOrder: number,
  linkedItemId?: string | null,
): Promise<string> {
  const created = await createModifierOption(db, SYSTEM_CALLER, {
    groupId,
    label,
    pricingMode: "included",
    linkedItemId: linkedItemId ?? null,
    sortOrder,
  });
  return created.id;
}

export async function importMenu(db: Database): Promise<void> {
  const [{ count: existingItemCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items);
  if (existingItemCount > 0) {
    console.log(`items table already has ${existingItemCount} rows — skipping menu import (reset first to reseed).`);
    return;
  }

  console.log(`Parsing ${FOOD_MD} and ${DRINKS_MD} ...`);
  const foodSections = parseFoodMenu(FOOD_MD);
  const drinks = parseDrinksMenu(DRINKS_MD);

  const sectionByName = new Map<string, ParsedFoodSection>(foodSections.map((s) => [s.name, s]));

  // --- Tags (PRD §3.1 seed sets, public AND private) -----------------------
  const tagIdByName = new Map<string, string>();
  for (const name of PUBLIC_TAGS) {
    const tag = await createTag(db, SYSTEM_CALLER, { name, visibility: "public" });
    tagIdByName.set(name, tag.id);
  }
  for (const name of PRIVATE_TAGS) {
    const tag = await createTag(db, SYSTEM_CALLER, { name, visibility: "private" });
    tagIdByName.set(name, tag.id);
  }

  // --- Categories ------------------------------------------------------------
  const categoryIdByName = new Map<string, string>();
  const categoryPlan: { name: string; type: CategoryType; sortOrder: number }[] = [
    { name: "Appetizers", type: "food", sortOrder: 0 },
    { name: "Burgers", type: "food", sortOrder: 1 },
    { name: "Sandwiches", type: "food", sortOrder: 2 },
    { name: "Sides", type: "food", sortOrder: 3 },
    { name: "Salads", type: "food", sortOrder: 4 },
    { name: "Desserts", type: "food", sortOrder: 5 },
    { name: "Pepsi Products", type: "drink", sortOrder: 6 },
    { name: "Bottles", type: "drink", sortOrder: 7 },
    { name: "Cans", type: "drink", sortOrder: 8 },
    { name: "Draft Beer", type: "drink", sortOrder: 9 },
    { name: "Drink of the Week", type: "drink", sortOrder: 10 },
  ];
  for (const plan of categoryPlan) {
    const parsedSection = sectionByName.get(plan.name);
    const category = await createCategory(db, SYSTEM_CALLER, {
      name: plan.name,
      type: plan.type,
      sortOrder: plan.sortOrder,
      tagline: parsedSection?.tagline ?? null,
    });
    categoryIdByName.set(plan.name, category.id);
  }

  const itemIdByName = new Map<string, string>();
  const tagsToApply = new Map<string, Set<string>>();
  const addTagToItem = (itemId: string, tagName: string) => {
    if (!tagsToApply.has(itemId)) tagsToApply.set(itemId, new Set());
    tagsToApply.get(itemId)!.add(tagIdByName.get(tagName)!);
  };

  async function createFoodItem(
    categoryName: string,
    name: string,
    priceCents: number | null,
    description: string | null,
    sortOrder: number,
    pricingType: "fixed" | "ask_server" | "tbd" = "fixed",
  ): Promise<string> {
    const created = await createItem(db, SYSTEM_CALLER, {
      name: normalizeName(name),
      description: normalizeDescription(description),
      priceCents,
      pricingType,
      categoryId: categoryIdByName.get(categoryName)!,
      sortOrder,
      aliases: getItemAliases(name),
    });
    itemIdByName.set(name, created.id);
    return created.id;
  }

  // --- Appetizers (10 headers -> 11 items: eggroll split) -------------------
  const appetizers = sectionByName.get("Appetizers")!;
  let sortOrder = 0;
  for (const it of appetizers.items) {
    if (it.name === "Southwestern or Philly Eggrolls") {
      // Owner decision: split into two items, same price each.
      await createFoodItem("Appetizers", "Southwestern Eggrolls", it.priceCents, it.description, sortOrder++);
      await createFoodItem("Appetizers", "Philly Eggrolls", it.priceCents, it.description, sortOrder++);
      continue;
    }
    await createFoodItem("Appetizers", it.name, it.priceCents, it.description, sortOrder++);
  }

  // --- Burgers ---------------------------------------------------------------
  const burgers = sectionByName.get("Burgers")!;
  sortOrder = 0;
  for (const it of burgers.items) {
    await createFoodItem("Burgers", it.name, it.priceCents, it.description, sortOrder++);
  }

  // --- Sandwiches (merge "Additional Sandwiches / Dogs" — both sections are
  // sandwich/dog items that include one side; splitting them into a
  // near-empty second category added no value; recorded as a deviation). ----
  const sandwiches = sectionByName.get("Sandwiches")!;
  const additionalSandwiches = sectionByName.get("Additional Sandwiches / Dogs");
  const allSandwichItems: ParsedFoodItem[] = [...sandwiches.items, ...(additionalSandwiches?.items ?? [])];
  sortOrder = 0;
  for (const it of allSandwichItems) {
    await createFoodItem("Sandwiches", it.name, it.priceCents, it.description, sortOrder++);
  }

  // --- Sides (12, real items, unpriced -> tbd) --------------------------------
  const sidesSection = sectionByName.get("Sides")!;
  const sideNames = sidesSection.paragraphs
    .join(" ")
    .replace(/\.$/, "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const sideItemIdsInOrder: string[] = [];
  sortOrder = 0;
  for (const name of sideNames) {
    const id = await createFoodItem("Sides", name, null, null, sortOrder++, "tbd");
    sideItemIdsInOrder.push(id);
  }

  // --- Salads ------------------------------------------------------------------
  const salads = sectionByName.get("Salads")!;
  sortOrder = 0;
  for (const it of salads.items) {
    await createFoodItem("Salads", it.name, it.priceCents, it.description, sortOrder++);
  }

  // --- Desserts (Dessert of the Day: ask_server, no price) ----------------------
  const desserts = sectionByName.get("Desserts")!;
  sortOrder = 0;
  for (const it of desserts.items) {
    const pricingType = it.name === "Dessert of the Day" ? "ask_server" : "fixed";
    await createFoodItem("Desserts", it.name, it.priceCents, it.description, sortOrder++, pricingType);
  }
  const dessertOfTheDayId = itemIdByName.get("Dessert of the Day")!;
  await setFeaturedSlot(db, SYSTEM_CALLER, dessertOfTheDayId, { featuredSlotKey: "dessert_of_the_day" });
  addTagToItem(dessertOfTheDayId, "special");

  // --- Pepsi Products (9, real items, unpriced -> tbd; tea split) -------------
  const pepsiSection = sectionByName.get("Pepsi Products")!;
  const rawPepsiNames = pepsiSection.paragraphs
    .join(" ")
    .replace(/\.$/, "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  sortOrder = 0;
  for (const name of rawPepsiNames) {
    if (name === "Sweet & Unsweet Tea") {
      await createFoodItem("Pepsi Products", "Sweet Tea", null, null, sortOrder++, "tbd");
      await createFoodItem("Pepsi Products", "Unsweet Tea", null, null, sortOrder++, "tbd");
      continue;
    }
    await createFoodItem("Pepsi Products", name, null, null, sortOrder++, "tbd");
  }

  // --- Bottles / Cans / Draft Beer / Drink of the Week (drinks file's own
  // printed prices -> fixed) ---------------------------------------------------
  async function createDrinkItem(
    categoryName: string,
    name: string,
    priceCents: number,
    description: string | null,
    idx: number,
    attributes?: Record<string, unknown>,
  ): Promise<string> {
    const created = await createItem(db, SYSTEM_CALLER, {
      name: normalizeName(name),
      description: normalizeDescription(description),
      priceCents,
      pricingType: "fixed",
      categoryId: categoryIdByName.get(categoryName)!,
      sortOrder: idx,
      aliases: getItemAliases(name),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attributes: (attributes ?? {}) as any,
    });
    itemIdByName.set(name, created.id);
    return created.id;
  }

  sortOrder = 0;
  for (const b of drinks.bottles) {
    const id = await createDrinkItem("Bottles", b.name, b.priceCents, b.description, sortOrder++);
    addTagToItem(id, "bottle");
    if (b.priceCents === 400) addTagToItem(id, "domestic");
    else if (b.priceCents === 550) addTagToItem(id, "import");
    if (b.name === "Daura Damm GF") addTagToItem(id, "gluten-free");
  }

  sortOrder = 0;
  for (const c of drinks.cans) {
    const id = await createDrinkItem("Cans", c.name, c.priceCents, c.description, sortOrder++);
    addTagToItem(id, "can");
    if (c.priceCents === 400) addTagToItem(id, "domestic");
    if (c.name === "Bud N/A") addTagToItem(id, "non-alcoholic");
  }
  {
    // Premier N/A lives in Bottles, tagged above via the bottles loop's name
    // check being absent — add it explicitly here.
    const premierId = itemIdByName.get("Premier N/A");
    if (premierId) addTagToItem(premierId, "non-alcoholic");
  }

  sortOrder = 0;
  for (const d of drinks.draftBeer) {
    const id = await createDrinkItem("Draft Beer", d.name, d.priceCents, null, sortOrder++, {
      abv: d.abv,
      style: d.style,
    });
    addTagToItem(id, "draft");
  }

  sortOrder = 0;
  for (const w of drinks.drinkOfTheWeek) {
    const id = await createDrinkItem("Drink of the Week", w.name, w.priceCents, w.description, sortOrder++);
    addTagToItem(id, "special");
    await setFeaturedSlot(db, SYSTEM_CALLER, id, { featuredSlotKey: "drink_of_the_week" });
  }

  // --- Apply accumulated tags --------------------------------------------------
  for (const [itemId, tagIdSet] of tagsToApply) {
    await setItemTags(db, SYSTEM_CALLER, itemId, { tagIds: Array.from(tagIdSet) });
  }

  // === Modifiers (addendum §1/§3) ============================================

  const rpmBurgerId = itemIdByName.get("RPM Burger")!;
  const rpmBurgerDesc = burgers.items.find((i) => i.name === "RPM Burger")!.description;
  {
    const group = await createModifierGroup(db, SYSTEM_CALLER, {
      name: "RPM Burger Add-ons",
      selectionType: "multiple",
      minSelect: 0,
      isRequired: false,
      sortOrder: 0,
    });
    await createModifierGroupAttachment(db, SYSTEM_CALLER, { groupId: group.id, itemId: rpmBurgerId, sortOrder: 0 });
    const addOnMatches = [...(rpmBurgerDesc ?? "").matchAll(/Add (?:your choice of )?([A-Za-z ]+?) \$([\d.]+)\./g)];
    let i = 0;
    for (const m of addOnMatches) {
      await getOrCreateOptionWithDelta(db, group.id, titleCase(m[1]), Math.round(parseFloat(m[2]) * 100), i++);
    }
  }

  // Pretzel add-on (deviation: item-level "Extra cheese $0.78." beyond the
  // task's explicitly-listed groups, same pattern as RPM Burger's add-ons).
  const pretzelsId = itemIdByName.get("Hot Bavarian Pretzels")!;
  const pretzelsItem = appetizers.items.find((i) => i.name === "Hot Bavarian Pretzels")!;
  {
    const extraCents = extractCents(pretzelsItem.description, /Extra cheese \$(\d+(?:\.\d{1,2})?)/);
    if (extraCents !== null) {
      const group = await createModifierGroup(db, SYSTEM_CALLER, {
        name: "Pretzel Add-ons",
        selectionType: "multiple",
        minSelect: 0,
        isRequired: false,
        sortOrder: 0,
      });
      await createModifierGroupAttachment(db, SYSTEM_CALLER, { groupId: group.id, itemId: pretzelsId, sortOrder: 0 });
      await getOrCreateOptionWithDelta(db, group.id, "Extra Cheese", extraCents, 0);
    }
  }

  // Burger Defaults — category-wide, attached to Burgers.
  {
    const group = await createModifierGroup(db, SYSTEM_CALLER, {
      name: "Burger Defaults",
      selectionType: "multiple",
      minSelect: 0,
      isRequired: false,
      sortOrder: 0,
    });
    await createModifierGroupAttachment(db, SYSTEM_CALLER, {
      groupId: group.id,
      categoryId: categoryIdByName.get("Burgers")!,
      sortOrder: 0,
    });
    const bulletText = burgers.bullets.join(" | ");
    const veggieCents = extractCents(bulletText, /veggie patty \$(\d+(?:\.\d{1,2})?)/);
    const gfBunCents = extractCents(bulletText, /Gluten-free bun or tortilla \$(\d+(?:\.\d{1,2})?)/);
    const extraPattyCents = extractCents(bulletText, /Add 1\/2 lb Angus beef patty \$(\d+(?:\.\d{1,2})?)/);
    let i = 0;
    if (veggieCents !== null) await getOrCreateOptionWithDelta(db, group.id, "Veggie Patty", veggieCents, i++);
    if (gfBunCents !== null) await getOrCreateOptionWithDelta(db, group.id, "GF Bun or Tortilla", gfBunCents, i++);
    if (extraPattyCents !== null) await getOrCreateOptionWithDelta(db, group.id, "Extra Patty", extraPattyCents, i++);
  }

  // Sandwich Defaults — category-wide, attached to Sandwiches.
  {
    const group = await createModifierGroup(db, SYSTEM_CALLER, {
      name: "Sandwich Defaults",
      selectionType: "multiple",
      minSelect: 0,
      isRequired: false,
      sortOrder: 0,
    });
    await createModifierGroupAttachment(db, SYSTEM_CALLER, {
      groupId: group.id,
      categoryId: categoryIdByName.get("Sandwiches")!,
      sortOrder: 0,
    });
    const bulletText = sandwiches.bullets.join(" | ");
    const wrapCents = extractCents(bulletText, /Sub tortilla wraps for any sandwich by request \$(\d+(?:\.\d{1,2})?)/);
    if (wrapCents !== null) await getOrCreateOptionWithDelta(db, group.id, "Wrap Sub", wrapCents, 0);
  }

  // Wing Sauce Choice — ONE group, 12 sauces from Jumbo Wings' description,
  // attached to every item whose description references the sauce list.
  const jumboWingsItem = appetizers.items.find((i) => i.name === "Jumbo Wings")!;
  {
    const sauceSentence = jumboWingsItem.description!.match(/Your choice of (.+?)\.$/)![1];
    const sauces = splitChoiceList(sauceSentence);
    const group = await createModifierGroup(db, SYSTEM_CALLER, {
      name: "Wing Sauce Choice",
      selectionType: "single",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      sortOrder: 0,
    });
    for (let idx = 0; idx < sauces.length; idx++) {
      await createIncludedOption(db, group.id, sauces[idx], idx);
    }

    // Jumbo Wings itself defines the list (doesn't literally say "wing
    // sauce"); every other item whose description references it does.
    const wingSauceItemNames = [
      "Jumbo Wings",
      ...allSandwichItems.filter((i) => /wing sauce/i.test(i.description ?? "")).map((i) => i.name),
    ];
    let attachIdx = 0;
    for (const name of wingSauceItemNames) {
      const itemId = itemIdByName.get(name);
      if (!itemId) continue;
      await createModifierGroupAttachment(db, SYSTEM_CALLER, { groupId: group.id, itemId, sortOrder: attachIdx++ });
    }
  }

  // Included Side — single, required, all included, one option per Sides
  // item (linked_item_id -> the Sides item). Attached to Sandwiches per the
  // task; also attached to Burgers (deviation — Burgers' own bullet list
  // says "Price includes one side of your choice" too, same pattern).
  {
    const group = await createModifierGroup(db, SYSTEM_CALLER, {
      name: "Included Side",
      selectionType: "single",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      sortOrder: 0,
    });
    for (let idx = 0; idx < sideNames.length; idx++) {
      await createIncludedOption(db, group.id, sideNames[idx], idx, sideItemIdsInOrder[idx]);
    }
    await createModifierGroupAttachment(db, SYSTEM_CALLER, {
      groupId: group.id,
      categoryId: categoryIdByName.get("Sandwiches")!,
      sortOrder: 0,
    });
    await createModifierGroupAttachment(db, SYSTEM_CALLER, {
      groupId: group.id,
      categoryId: categoryIdByName.get("Burgers")!,
      sortOrder: 1,
    });
  }

  // --- Protein-choice groups (deviation: implied by section-wide "Choose
  // either grilled chicken or grilled steak." / substitution phrasing beyond
  // the three explicitly-listed upcharges) --------------------------------

  async function addProteinChoiceGroup(
    itemName: string,
    options: { label: string; deltaCents?: number }[],
    required: boolean,
    groupName: string,
  ) {
    const itemId = itemIdByName.get(itemName);
    if (!itemId) return;
    const group = await createModifierGroup(db, SYSTEM_CALLER, {
      name: groupName,
      selectionType: "single",
      minSelect: required ? 1 : 0,
      maxSelect: 1,
      isRequired: required,
      sortOrder: 0,
    });
    await createModifierGroupAttachment(db, SYSTEM_CALLER, { groupId: group.id, itemId, sortOrder: 0 });
    let idx = 0;
    for (const opt of options) {
      if (opt.deltaCents !== undefined) {
        await getOrCreateOptionWithDelta(db, group.id, opt.label, opt.deltaCents, idx++);
      } else {
        await createIncludedOption(db, group.id, opt.label, idx++);
      }
    }
  }

  const phillyDesc = allSandwichItems.find((i) => i.name === "The Philly")!.description;
  const phillyMatch = phillyDesc?.match(/^(.+?) or (.+?) chopped/);
  if (phillyMatch) {
    await addProteinChoiceGroup(
      "The Philly",
      [{ label: titleCase(phillyMatch[1]) }, { label: titleCase(phillyMatch[2]) }],
      true,
      "Protein Choice",
    );
  }

  const streetTacosDesc = allSandwichItems.find((i) => i.name === "Street Tacos")!.description!;
  const tacosChoiceMatch = streetTacosDesc.match(/Choose either (.+?) or (.+?)\./);
  const tacosShrimpCents = extractCents(streetTacosDesc, /Fried shrimp w\/ Thai chili \$(\d+(?:\.\d{1,2})?)/);
  if (tacosChoiceMatch) {
    const opts: { label: string; deltaCents?: number }[] = [
      { label: titleCase(tacosChoiceMatch[1]) },
      { label: titleCase(tacosChoiceMatch[2]) },
    ];
    if (tacosShrimpCents !== null) opts.push({ label: "Fried Shrimp w/ Thai Chili", deltaCents: tacosShrimpCents });
    await addProteinChoiceGroup("Street Tacos", opts, true, "Protein Choice");
  }

  const quesadillaDesc = allSandwichItems.find((i) => i.name === "Grilled Quesadilla")!.description;
  const quesadillaMatch = quesadillaDesc?.match(/Choose either (.+?) or (.+?)\./);
  if (quesadillaMatch) {
    await addProteinChoiceGroup(
      "Grilled Quesadilla",
      [{ label: titleCase(quesadillaMatch[1]) }, { label: titleCase(quesadillaMatch[2]) }],
      true,
      "Protein Choice",
    );
  }

  const bltDesc = allSandwichItems.find((i) => i.name === "Blackened Chicken BLT")!.description;
  const salmonCents = extractCents(bltDesc, /Sub grilled salmon \$(\d+(?:\.\d{1,2})?)/);
  if (salmonCents !== null) {
    await addProteinChoiceGroup(
      "Blackened Chicken BLT",
      [{ label: "Grilled Salmon", deltaCents: salmonCents }],
      false,
      "Substitute Protein",
    );
  }

  const salmonCaesarDesc = salads.items.find((i) => i.name === "Blackened Salmon Caesar")!.description;
  const caesarChickenCents = extractCents(salmonCaesarDesc, /Blackened Chicken Caesar \$(\d+(?:\.\d{1,2})?)/);
  if (caesarChickenCents !== null) {
    await addProteinChoiceGroup(
      "Blackened Salmon Caesar",
      [{ label: "Chicken", deltaCents: caesarChickenCents }],
      false,
      "Substitute Protein",
    );
  }

  // --- Size variants (item_price_variants, kind='size') -----------------------
  if (pretzelsItem.headerPriceVariants.length > 0) {
    const [{ label, priceCents }] = pretzelsItem.headerPriceVariants;
    await createItemPriceVariant(db, SYSTEM_CALLER, { itemId: pretzelsId, label, priceCents, kind: "size", sortOrder: 0 });
  }

  const reubenDesc = allSandwichItems.find((i) => i.name === "Monster Reuben")!.description;
  const reubenHalfCents = extractCents(reubenDesc, /Half \$(\d+(?:\.\d{1,2})?)/);
  if (reubenHalfCents !== null) {
    await createItemPriceVariant(db, SYSTEM_CALLER, {
      itemId: itemIdByName.get("Monster Reuben")!,
      label: "Half",
      priceCents: reubenHalfCents,
      kind: "size",
      sortOrder: 0,
    });
  }

  const franksterDesc = allSandwichItems.find((i) => i.name === "The Frankster")!.description;
  const franksterOneCents = extractCents(franksterDesc, /One \$(\d+(?:\.\d{1,2})?)/);
  if (franksterOneCents !== null) {
    await createItemPriceVariant(db, SYSTEM_CALLER, {
      itemId: itemIdByName.get("The Frankster")!,
      label: "One",
      priceCents: franksterOneCents,
      kind: "size",
      sortOrder: 0,
    });
  }

  const roadDogsDesc = allSandwichItems.find((i) => i.name === "Road Dogs")!.description;
  const roadDogsOneCents = extractCents(roadDogsDesc, /One \$(\d+(?:\.\d{1,2})?)/);
  if (roadDogsOneCents !== null) {
    await createItemPriceVariant(db, SYSTEM_CALLER, {
      itemId: itemIdByName.get("Road Dogs")!,
      label: "One",
      priceCents: roadDogsOneCents,
      kind: "size",
      sortOrder: 0,
    });
  }

  const corndogsDesc = allSandwichItems.find((i) => i.name === "Foot Long Corndogs")!.description;
  const corndogsSoloCents = extractCents(corndogsDesc, /Solo Corndog \$(\d+(?:\.\d{1,2})?)/);
  if (corndogsSoloCents !== null) {
    await createItemPriceVariant(db, SYSTEM_CALLER, {
      itemId: itemIdByName.get("Foot Long Corndogs")!,
      label: "Solo",
      priceCents: corndogsSoloCents,
      kind: "size",
      sortOrder: 0,
    });
  }

  // === Venue settings (PRD §3.8, food file's Notes footer) ====================
  const notesSection = sectionByName.get("Notes");
  const notesLines = notesSection?.paragraphs ?? [];
  const phoneLine = notesLines.find((l) => /\(\d{3}\)\s?\d{3}-\d{4}/.test(l));
  const addressLine = notesLines.find((l) => /\d{5}/.test(l) && /(St\.|Ave|Rd|Blvd|Street)/i.test(l));
  const websiteLine = notesLines.find((l) => /www\./i.test(l));
  const website = websiteLine?.replace(/^Visit:\s*/i, "").trim() ?? null;
  // Venue name derived from the website domain itself
  // ("www.RPMNewnan.com" -> "RPM") rather than hand-typed.
  const nameMatch = website?.match(/www\.([A-Za-z]+)Newnan\.com/i);
  const venueName = nameMatch ? nameMatch[1] : "RPM";

  await db
    .update(venueSettings)
    .set({
      name: venueName,
      address: addressLine ?? null,
      phone: phoneLine?.trim() ?? null,
      // Newnan, GA is Eastern time — not printed anywhere in the source
      // text, so this constant is the one piece of venue data that is
      // genuinely owner-confirmed rather than extracted (per the seed
      // task's explicit instruction).
      timezone: "America/New_York",
      social: website ? { website: `https://${website.replace(/^https?:\/\//i, "")}` } : {},
      updatedAt: new Date(),
    })
    .where(eq(venueSettings.id, VENUE_SETTINGS_ID));
  console.log(`venue_settings updated: name=${venueName} timezone=America/New_York address="${addressLine}"`);

  // === Hard assertions =========================================================
  const [{ count: totalItems }] = await db.select({ count: sql<number>`count(*)::int` }).from(items);
  const EXPECTED_TOTAL_ITEMS = 101; // 43 food (incl. eggroll split) + 12 sides + 9 soft drinks (incl. tea split) + 37 drinks
  if (totalItems !== EXPECTED_TOTAL_ITEMS) {
    throw new Error(`Assertion failed: expected ${EXPECTED_TOTAL_ITEMS} items, found ${totalItems}`);
  }

  const wingSauceOptionCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(modifierOptions)
    .where(sql`${modifierOptions.groupId} = (select id from modifier_groups where name = 'Wing Sauce Choice')`);
  const wingSauceCount = wingSauceOptionCount[0]?.count ?? 0;
  if (wingSauceCount !== 12) {
    throw new Error(`Assertion failed: expected 12 Wing Sauce Choice options, found ${wingSauceCount}`);
  }

  const includedSideOptions = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(modifierOptions)
    .where(sql`${modifierOptions.groupId} = (select id from modifier_groups where name = 'Included Side')`);
  const includedSideCount = includedSideOptions[0]?.count ?? 0;
  if (includedSideCount !== 12) {
    throw new Error(`Assertion failed: expected 12 Included Side options, found ${includedSideCount}`);
  }

  const sidesCategoryId = categoryIdByName.get("Sides")!;
  const linkedToSides = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(modifierOptions)
    .innerJoin(items, eq(items.id, modifierOptions.linkedItemId))
    .where(
      and(
        sql`${modifierOptions.groupId} = (select id from modifier_groups where name = 'Included Side')`,
        eq(items.categoryId, sidesCategoryId),
      ),
    );
  const linkedToSidesCount = linkedToSides[0]?.count ?? 0;
  if (linkedToSidesCount !== 12) {
    throw new Error(
      `Assertion failed: expected all 12 Included Side options linked to a Sides item, found ${linkedToSidesCount}`,
    );
  }

  const ambiguousWithPrice = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(modifierOptions)
    .where(
      and(
        eq(modifierOptions.pricingMode, "ambiguous"),
        sql`(${modifierOptions.priceDeltaCents} is not null or ${modifierOptions.replacementPriceCents} is not null)`,
      ),
    );
  const ambiguousWithPriceCount = ambiguousWithPrice[0]?.count ?? 0;
  if (ambiguousWithPriceCount !== 0) {
    throw new Error(
      `Assertion failed: expected 0 ambiguous modifier options with a non-null price, found ${ambiguousWithPriceCount}`,
    );
  }

  // Search-alias spot check (task's own named examples: "BLT", "reuben",
  // "corndog") — guards against the aliases wiring silently regressing to []
  // (e.g. a future refactor dropping the `aliases:` field from the
  // createItem() calls above).
  const aliasSpotChecks: { itemName: string; expectedAlias: string }[] = [
    { itemName: "Blackened Chicken BLT", expectedAlias: "BLT" },
    { itemName: "Monster Reuben", expectedAlias: "Reuben" },
    { itemName: "Foot Long Corndogs", expectedAlias: "Corndog" },
  ];
  for (const { itemName, expectedAlias } of aliasSpotChecks) {
    const itemId = itemIdByName.get(itemName);
    if (!itemId) throw new Error(`Assertion failed: alias spot check couldn't find item "${itemName}"`);
    const [row] = await db.select({ aliases: items.aliases }).from(items).where(eq(items.id, itemId));
    if (!row?.aliases.includes(expectedAlias)) {
      throw new Error(
        `Assertion failed: expected "${itemName}" aliases to include "${expectedAlias}", found [${row?.aliases.join(", ")}]`,
      );
    }
  }

  const itemsWithAnyAlias = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
    .where(sql`array_length(${items.aliases}, 1) > 0`);
  const itemsWithAnyAliasCount = itemsWithAnyAlias[0]?.count ?? 0;
  if (itemsWithAnyAliasCount === 0) {
    throw new Error("Assertion failed: expected at least one item with a populated aliases array, found 0");
  }

  console.log("All hard assertions passed:");
  console.log(`  total items = ${totalItems}`);
  console.log(`  Wing Sauce Choice options = ${wingSauceCount}`);
  console.log(`  Included Side options = ${includedSideCount} (all linked to Sides items)`);
  console.log(`  ambiguous options with a non-null price = ${ambiguousWithPriceCount}`);
  console.log(`  items with a populated aliases array = ${itemsWithAnyAliasCount}`);
}
