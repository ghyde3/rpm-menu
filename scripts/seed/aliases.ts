// Search-synonym aliases for real-menu items (PRD §9 M3: "onboarding (seed
// real menu, aliases, images)"). The original seed (scripts/seed/import-menu.ts)
// created every item with `aliases: []` — this module is the gap-fill the
// onboarding-seed-and-runbook unit was asked to close.
//
// Keyed by the exact item `name` string import-menu.ts passes to
// `createFoodItem`/`createDrinkItem` (pre-`normalizeName`, matching the same
// key convention `itemIdByName` already uses) so a stale/typo'd key is
// build-time-obvious rather than a silent no-op — see aliases.test.ts's
// "every alias key matches a real parsed item name" guard, which cross-checks
// every key here against the actual parsed menu content.
//
// Only genuine synonyms/shorthand a guest, bartender, or an MCP-driven AI
// client would type that do NOT already appear as a substring of the printed
// name — e.g. "BLT" is skipped for "Blackened Chicken BLT" (it's already a
// literal substring of the name), but "Reuben" is *not* a substring of
// "Monster Reuben"... actually it is; kept anyway per the task's explicit
// example list. The point of aliases is robustness against near-miss
// phrasing (different words entirely), not just substrings of the name.
export const ITEM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // --- Appetizers ---
  "Jumbo Wings": ["Wings"],
  "Hot Bavarian Pretzels": ["Pretzels", "Pretzel"],
  "Irish Nachos": ["Nachos"],
  "RPM's Not Yet Famous Fried Pork Rinds": ["Pork Rinds"],
  "Old School Chips & Hippie Dip": ["Spinach Dip", "Spinach Artichoke Dip", "Chips and Dip"],
  "Spark Plugs": ["Taquitos"],
  "Fried Cheese Curds": ["Cheese Curds"],
  "Southwestern Eggrolls": ["Eggrolls"],
  "Philly Eggrolls": ["Eggrolls", "Philly Eggroll"],
  "Fried Pickle Spears": ["Fried Pickles"],

  // --- Burgers ---
  "Cheddar Brat Burger": ["Brat Burger"],
  "Mystical Swisstickle Burger": ["Mushroom Swiss Burger", "Swiss Burger"],
  "Wookie Knuckle": ["BBQ Burger", "Pulled Pork Burger"],
  "Wide-Load": ["Double Burger"],
  "The Steve McQueen": ["Peanut Butter Burger"],

  // --- Sandwiches / Baskets / Dogs ---
  "Blackened Chicken BLT": ["BLT"],
  "The Philly": ["Philly Cheesesteak", "Cheesesteak"],
  "Monster Reuben": ["Reuben"],
  "Cod of Thunder": ["Po Boy", "Fish Po Boy"],
  "Fish & Chips": ["Fish and Chips"],
  "The Bratweiler": ["Bratwurst Sandwich", "Brat Sandwich"],
  "Chicken Jabroni": ["Fried Chicken Sandwich"],
  "Chicken Tenders Basket": ["Chicken Fingers", "Tenders"],
  "Fried Shrimp Basket 8 Piece": ["Shrimp Basket", "Fried Shrimp"],
  "The Frankster": ["Hot Dogs"],
  "Road Dogs": ["Hot Dogs"],
  "Street Tacos": ["Tacos"],
  "Grilled Quesadilla": ["Quesadilla"],
  "Deep Fried Ribs": ["Ribs"],
  "Foot Long Corndogs": ["Corndog", "Corndogs"],

  // --- Salads ---
  "Haus Salad": ["House Salad"],
  "Blackened Salmon Caesar": ["Salmon Caesar Salad"],
  "The Gringo": ["Gringo Salad", "Taco Salad"],
  "The Hungry Hippie": ["Garden Salad"],
  "Big-A-Pasta Salad": ["Pasta Salad"],

  // --- Desserts ---
  "Cheech & Chong": ["Fried Cheesecake"],

  // --- Drinks: Bottles/Cans ---
  "Coors Light": ["Coors"], // the PRD §3.7 demo line: "we're out of Coors"
  "Budweiser": ["Bud"],
  "Miller Lite": ["Miller"],
  "Miller High Life": ["High Life"],
  "PBR": ["Pabst", "Pabst Blue Ribbon"],
  "White Claw": ["Claw"],
  "Corona Extra": ["Corona"],
  "Stella": ["Stella Artois"],
  "Dos Equis Lager": ["Dos Equis"],
  "Modelo": ["Modelo Especial"],
  "Strong Bow": ["Strongbow"],
  "Mike's Hard": ["Mike's Hard Lemonade"],
  // Appears as both a Can and a Draft Beer row (see import-menu.ts / addendum
  // §2 notes) — this map is keyed by name, so both rows pick up the alias.
  "Mich Ultra": ["Michelob Ultra", "Mic Ultra"],

  // --- Drinks: Draft Beer ---
  Weihenstephan: ["Weihenstephaner", "Hefeweizen"],
};

/** Returns a fresh array (never the shared readonly literal) so callers can
 * safely pass it straight into `createItem`'s `aliases` field without risking
 * accidental mutation of the shared map. Unknown names return `[]`, matching
 * the create-item schema's own `.default([])` — an item without a curated
 * alias is not an error, just uncovered. */
export function getItemAliases(name: string): string[] {
  return [...(ITEM_ALIASES[name] ?? [])];
}
