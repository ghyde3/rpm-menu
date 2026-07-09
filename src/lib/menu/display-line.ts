// Shared "display line" render helper (PRD §3.1 "Item Display Schema"):
// turns a category's `display_config` + an item's `attributes`/`description`
// into the ordered, per-surface line screen-templates/public-menu/mcp-server
// narration all render — so a `list` screen mixing drafts and cocktails
// renders ABV for one and flavor profile for the other automatically,
// without any template hardcoding item fields.
//
// This module is display-only: it never touches price. Price formatting
// (including the ambiguous-pricing fail-safe) lives exclusively in
// src/lib/pricing.ts — callers combine both.
import type { Category, CategoryDisplayConfig, CategoryType, Item, ItemAttributes } from "@/db/schema";

/** Which rendering surface is asking — a `list`/`grid`/`spotlight` TV
 * template ("display") vs. the public web menu ("web"). Matches
 * `display_config.showDescription.{web,display}` (§3.1). */
export type DisplaySurface = "web" | "display";

export const ATTRIBUTE_KEYS = ["abv", "ibu", "flavor_profile", "origin", "calories", "style"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

/**
 * Ship-with-sensible-defaults per §3.1 ("so onboarding doesn't require
 * configuring anything"): applied only when a category's own
 * `display_config` doesn't specify the corresponding key (an empty `{}` —
 * the schema default on category creation — falls all the way through to
 * these). Individual categories (e.g. a "Cocktails" category set to lead
 * with `flavor_profile` instead of `abv`/`ibu`) override by setting their
 * own `display_config`.
 */
const DEFAULT_DISPLAY_CONFIG_BY_TYPE: Record<CategoryType, Required<Pick<CategoryDisplayConfig, "attributeOrder" | "showBadges">> & { showDescription: { web: boolean; display: boolean } }> = {
  food: {
    attributeOrder: [],
    showDescription: { web: true, display: true },
    showBadges: true,
  },
  drink: {
    // Draft Beer example (§3.1): "Name · ABV/IBU line · Price. No
    // description on TV". Style/flavor_profile/origin fill in after
    // abv/ibu for categories that carry them (e.g. draft beer style).
    attributeOrder: ["abv", "ibu", "style", "flavor_profile", "origin"],
    showDescription: { web: true, display: false },
    showBadges: true,
  },
};

/** Formats one typed-attribute value into its on-menu text per §3.1's
 * examples ("5.2% ABV", "IBU 38"). `flavor_profile`/`origin`/`style` are
 * already human-authored short text (e.g. "smoky · citrus · bitter") and
 * render verbatim. */
export function formatAttributeValue(key: AttributeKey, value: number | string): string {
  switch (key) {
    case "abv":
      return `${value}% ABV`;
    case "ibu":
      return `IBU ${value}`;
    case "calories":
      return `${value} cal`;
    case "flavor_profile":
    case "origin":
    case "style":
      return String(value);
    default: {
      const _exhaustive: never = key;
      return String(_exhaustive);
    }
  }
}

/** Resolves the *effective* display config for a category: explicit keys
 * from `category.displayConfig` win; anything unset falls back to the
 * category-type default. */
export function resolveDisplayConfig(
  category: Pick<Category, "type" | "displayConfig">,
): { attributeOrder: AttributeKey[]; showDescription: { web: boolean; display: boolean }; showBadges: boolean } {
  const defaults = DEFAULT_DISPLAY_CONFIG_BY_TYPE[category.type];
  const config = category.displayConfig ?? {};
  return {
    attributeOrder: (config.attributeOrder as AttributeKey[] | undefined) ?? defaults.attributeOrder,
    showDescription: {
      web: config.showDescription?.web ?? defaults.showDescription.web,
      display: config.showDescription?.display ?? defaults.showDescription.display,
    },
    showBadges: config.showBadges ?? defaults.showBadges,
  };
}

export interface DisplayLineResult {
  /** Ordered, formatted attribute segments present on the item, respecting
   * the resolved `attributeOrder` — e.g. `["5.2% ABV", "IBU 38"]` for a
   * draft beer, `["smoky · citrus · bitter"]` for a cocktail. Attributes the
   * category doesn't list, or the item doesn't have, are omitted (never
   * rendered as "undefined" or an empty chip). */
  attributeSegments: string[];
  /** `attributeSegments` joined with " · " — ready to drop straight into a
   * MenuItem `note`/subtitle slot — or `null` when there are none. */
  attributeLine: string | null;
  /** Whether `item.description` should render on `surface`, per the
   * resolved `display_config.showDescription`. */
  showDescription: boolean;
  /** `item.description` when `showDescription` is true, else `null` — never
   * an empty string, so callers can treat `null` as "render nothing" the
   * same way `pricing.ts` treats a null price. */
  description: string | null;
  /** Whether this category's items should show public-tag badges at all
   * (`display_config.showBadges`, default true). Callers still filter to
   * `tag.visibility === "public"` themselves — this is a category-level
   * on/off switch, not a substitute for that filter. */
  showBadges: boolean;
}

/**
 * Builds the shared "display line" for one item, given the category it
 * belongs to and which surface is rendering it. Pure function — no DB
 * access — so screen-templates, the public menu, and MCP narration can all
 * call it with whatever `Item`/`Category` rows they already have loaded.
 */
export function getItemDisplayLine(
  item: Pick<Item, "description" | "attributes">,
  category: Pick<Category, "type" | "displayConfig">,
  surface: DisplaySurface,
): DisplayLineResult {
  const resolved = resolveDisplayConfig(category);
  const attributes: ItemAttributes = item.attributes ?? {};

  const attributeSegments = resolved.attributeOrder
    .filter((key) => attributes[key] !== undefined && attributes[key] !== null)
    .map((key) => formatAttributeValue(key, attributes[key] as number | string));

  const showDescription = resolved.showDescription[surface];
  const description = showDescription && item.description ? item.description : null;

  return {
    attributeSegments,
    attributeLine: attributeSegments.length > 0 ? attributeSegments.join(" · ") : null,
    showDescription,
    description,
    showBadges: resolved.showBadges,
  };
}
