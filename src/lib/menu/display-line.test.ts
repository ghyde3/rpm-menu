import { describe, expect, it } from "vitest";
import { formatAttributeValue, getItemDisplayLine, resolveDisplayConfig } from "./display-line";
import type { Category, Item } from "@/db/schema";

function makeCategory(overrides: Partial<Pick<Category, "type" | "displayConfig">>): Pick<
  Category,
  "type" | "displayConfig"
> {
  return { type: "drink", displayConfig: {}, ...overrides };
}

function makeItem(overrides: Partial<Pick<Item, "description" | "attributes">>): Pick<
  Item,
  "description" | "attributes"
> {
  return { description: null, attributes: {}, ...overrides };
}

describe("display-line", () => {
  describe("formatAttributeValue", () => {
    it("formats abv/ibu/calories with units", () => {
      expect(formatAttributeValue("abv", 5.4)).toBe("5.4% ABV");
      expect(formatAttributeValue("ibu", 38)).toBe("IBU 38");
      expect(formatAttributeValue("calories", 320)).toBe("320 cal");
    });

    it("renders flavor_profile/origin/style verbatim", () => {
      expect(formatAttributeValue("flavor_profile", "smoky · citrus · bitter")).toBe("smoky · citrus · bitter");
      expect(formatAttributeValue("origin", "Belgium")).toBe("Belgium");
      expect(formatAttributeValue("style", "Hefeweizen")).toBe("Hefeweizen");
    });
  });

  describe("resolveDisplayConfig", () => {
    it("defaults a drink category to abv/ibu/style/flavor_profile/origin, description hidden on TV", () => {
      const resolved = resolveDisplayConfig(makeCategory({ type: "drink" }));
      expect(resolved.attributeOrder).toEqual(["abv", "ibu", "style", "flavor_profile", "origin"]);
      expect(resolved.showDescription).toEqual({ web: true, display: false });
      expect(resolved.showBadges).toBe(true);
    });

    it("defaults a food category to no attributes, description shown everywhere", () => {
      const resolved = resolveDisplayConfig(makeCategory({ type: "food" }));
      expect(resolved.attributeOrder).toEqual([]);
      expect(resolved.showDescription).toEqual({ web: true, display: true });
    });

    it("lets an explicit display_config override the type default (Cocktails leading with flavor_profile)", () => {
      const resolved = resolveDisplayConfig(
        makeCategory({
          type: "drink",
          displayConfig: { attributeOrder: ["flavor_profile"], showBadges: false },
        }),
      );
      expect(resolved.attributeOrder).toEqual(["flavor_profile"]);
      expect(resolved.showBadges).toBe(false);
      // Untouched keys still fall back to the type default.
      expect(resolved.showDescription).toEqual({ web: true, display: false });
    });

    it("lets a category override only one surface's showDescription", () => {
      const resolved = resolveDisplayConfig(
        makeCategory({ type: "drink", displayConfig: { showDescription: { display: true } } }),
      );
      expect(resolved.showDescription).toEqual({ web: true, display: true });
    });
  });

  describe("getItemDisplayLine", () => {
    it("builds a draft beer's ABV/IBU line and hides description on TV", () => {
      const category = makeCategory({ type: "drink" });
      const item = makeItem({ attributes: { abv: 5.4, ibu: 22 }, description: "Crisp German lager." });

      const tv = getItemDisplayLine(item, category, "display");
      expect(tv.attributeSegments).toEqual(["5.4% ABV", "IBU 22"]);
      expect(tv.attributeLine).toBe("5.4% ABV · IBU 22");
      expect(tv.showDescription).toBe(false);
      expect(tv.description).toBeNull();

      const web = getItemDisplayLine(item, category, "web");
      expect(web.showDescription).toBe(true);
      expect(web.description).toBe("Crisp German lager.");
    });

    it("omits attributes the item doesn't have rather than rendering a blank segment", () => {
      const category = makeCategory({ type: "drink" });
      const item = makeItem({ attributes: { abv: 6.1 } });
      const line = getItemDisplayLine(item, category, "web");
      expect(line.attributeSegments).toEqual(["6.1% ABV"]);
    });

    it("returns null attributeLine and null description when there is nothing to show", () => {
      const category = makeCategory({ type: "food" });
      const item = makeItem({});
      const line = getItemDisplayLine(item, category, "display");
      expect(line.attributeLine).toBeNull();
      expect(line.description).toBeNull();
    });

    it("renders a cocktail's flavor profile line per a category-level override", () => {
      const category = makeCategory({
        type: "drink",
        displayConfig: { attributeOrder: ["flavor_profile"] },
      });
      const item = makeItem({
        attributes: { flavor_profile: "smoky · citrus · bitter" },
        description: "Mezcal, lime, agave.",
      });
      const line = getItemDisplayLine(item, category, "web");
      expect(line.attributeLine).toBe("smoky · citrus · bitter");
      expect(line.description).toBe("Mezcal, lime, agave.");
    });

    it("never shows a description when the category's showDescription is false for that surface, even if the item has one", () => {
      const category = makeCategory({ type: "drink" });
      const item = makeItem({ description: "Should not show on TV" });
      const line = getItemDisplayLine(item, category, "display");
      expect(line.description).toBeNull();
    });

    it("respects showBadges default true / explicit false", () => {
      const defaultCategory = makeCategory({ type: "food" });
      expect(getItemDisplayLine(makeItem({}), defaultCategory, "web").showBadges).toBe(true);

      const noBadges = makeCategory({ type: "food", displayConfig: { showBadges: false } });
      expect(getItemDisplayLine(makeItem({}), noBadges, "web").showBadges).toBe(false);
    });
  });
});
