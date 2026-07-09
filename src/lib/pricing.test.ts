import { describe, expect, it } from "vitest";
import { formatOptionPrice, formatPrice, resolveOptionPrice } from "./pricing";

describe("formatPrice", () => {
  it("formats integer cents as a $X.XX string", () => {
    expect(formatPrice(1052)).toBe("$10.52");
    expect(formatPrice(500)).toBe("$5.00");
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("returns null for null/undefined — never coerces to $0.00", () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
  });

  it("respects a custom symbol", () => {
    expect(formatPrice(1000, { symbol: "€" })).toBe("€10.00");
  });

  it("drops trailing zeros when showTrailingZeros is false and the amount is whole", () => {
    expect(formatPrice(500, { showTrailingZeros: false })).toBe("$5");
    expect(formatPrice(550, { showTrailingZeros: false })).toBe("$5.50");
  });
});

describe("resolveOptionPrice", () => {
  it("refuses to resolve a price for pricing_mode='ambiguous' even when delta/replacement columns are populated", () => {
    const resolved = resolveOptionPrice({
      pricingMode: "ambiguous",
      priceDeltaCents: 1063,
      replacementPriceCents: 1663,
    });
    expect(resolved).toEqual({ cents: null, kind: null, needsReview: true });
  });

  it("resolves included options to 0 cents, no review needed", () => {
    expect(
      resolveOptionPrice({ pricingMode: "included", priceDeltaCents: null, replacementPriceCents: null }),
    ).toEqual({ cents: 0, kind: "included", needsReview: false });
  });

  it("resolves a delta option from price_delta_cents", () => {
    expect(
      resolveOptionPrice({ pricingMode: "delta", priceDeltaCents: 104, replacementPriceCents: null }),
    ).toEqual({ cents: 104, kind: "delta", needsReview: false });
  });

  it("resolves a replacement option from replacement_price_cents", () => {
    expect(
      resolveOptionPrice({
        pricingMode: "replacement",
        priceDeltaCents: null,
        replacementPriceCents: 1663,
      }),
    ).toEqual({ cents: 1663, kind: "replacement", needsReview: false });
  });

  it("flags a delta/replacement mode as needing review when its price column is still NULL", () => {
    expect(
      resolveOptionPrice({ pricingMode: "delta", priceDeltaCents: null, replacementPriceCents: null }),
    ).toEqual({ cents: null, kind: null, needsReview: true });
    expect(
      resolveOptionPrice({
        pricingMode: "replacement",
        priceDeltaCents: null,
        replacementPriceCents: null,
      }),
    ).toEqual({ cents: null, kind: null, needsReview: true });
  });
});

describe("formatOptionPrice", () => {
  it("never renders a string for an ambiguous option", () => {
    expect(
      formatOptionPrice({
        pricingMode: "ambiguous",
        priceDeltaCents: null,
        replacementPriceCents: null,
      }),
    ).toBeNull();
  });

  it("formats a resolved delta option", () => {
    expect(
      formatOptionPrice({ pricingMode: "delta", priceDeltaCents: 52, replacementPriceCents: null }),
    ).toBe("$0.52");
  });
});
