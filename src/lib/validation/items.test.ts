// Regression tests for the Zod v4 `.partial()` + `.default(...)` silent-
// reset bug (see screens.ts's `updateScreenSchema` block comment). Each
// defaulted `createItemSchema`/`createItemPriceVariantSchema` field must be
// truly ABSENT from `updateItemSchema`/`updateItemPriceVariantSchema`'s
// parsed output when omitted from the input — not silently reset to its
// create-time default.
import { describe, expect, it } from "vitest";
import { updateItemSchema, updateItemPriceVariantSchema } from "./items";

describe("updateItemSchema", () => {
  it("omits pricingType/isAvailable/sortOrder/aliases/attributes when not supplied, rather than defaulting them", () => {
    const parsed = updateItemSchema.parse({ priceCents: 1200 });
    expect(parsed).toEqual({ priceCents: 1200 });
    expect("pricingType" in parsed).toBe(false);
    expect("isAvailable" in parsed).toBe(false);
    expect("sortOrder" in parsed).toBe(false);
    expect("aliases" in parsed).toBe(false);
    expect("attributes" in parsed).toBe(false);
    expect("categoryId" in parsed).toBe(false);
  });

  it("still accepts and validates every field when explicitly supplied", () => {
    const parsed = updateItemSchema.parse({
      pricingType: "ask_server",
      isAvailable: false,
      sortOrder: 3,
      aliases: ["nickname"],
      attributes: { abv: 5 },
    });
    expect(parsed).toEqual({
      pricingType: "ask_server",
      isAvailable: false,
      sortOrder: 3,
      aliases: ["nickname"],
      attributes: { abv: 5 },
    });
  });

  it("accepts an empty object (no-op update)", () => {
    expect(updateItemSchema.parse({})).toEqual({});
  });
});

describe("updateItemPriceVariantSchema", () => {
  it("omits sortOrder/kind when not supplied, rather than defaulting them", () => {
    const parsed = updateItemPriceVariantSchema.parse({ label: "Pint" });
    expect(parsed).toEqual({ label: "Pint" });
    expect("sortOrder" in parsed).toBe(false);
    expect("kind" in parsed).toBe(false);
  });

  it("still rejects a null priceCents when the field is supplied", () => {
    expect(() => updateItemPriceVariantSchema.parse({ priceCents: null })).toThrow();
  });

  it("accepts a valid priceCents when supplied", () => {
    const parsed = updateItemPriceVariantSchema.parse({ priceCents: 500 });
    expect(parsed).toEqual({ priceCents: 500 });
  });
});
