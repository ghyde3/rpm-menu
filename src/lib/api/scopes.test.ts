import { describe, expect, it } from "vitest";
import {
  hasScope,
  hasAllScopes,
  updateItemRequiresPriceScope,
  scopeForBulkChangeType,
} from "./scopes";

describe("scopes", () => {
  it("hasScope checks membership", () => {
    expect(hasScope(["read", "write:items"], "read")).toBe(true);
    expect(hasScope(["read"], "write:prices")).toBe(false);
  });

  it("hasAllScopes requires every listed scope", () => {
    expect(hasAllScopes(["read", "write:items", "write:prices"], ["write:items", "write:prices"])).toBe(true);
    expect(hasAllScopes(["read", "write:items"], ["write:items", "write:prices"])).toBe(false);
    expect(hasAllScopes(["read"], [])).toBe(true);
  });

  it("updateItemRequiresPriceScope flags priceCents/pricingType touches only", () => {
    expect(updateItemRequiresPriceScope({})).toBe(false);
    expect(updateItemRequiresPriceScope({ name: "New Name" } as never)).toBe(false);
    expect(updateItemRequiresPriceScope({ priceCents: 500 })).toBe(true);
    expect(updateItemRequiresPriceScope({ priceCents: null })).toBe(true);
    expect(updateItemRequiresPriceScope({ pricingType: "ask_server" })).toBe(true);
  });

  it("scopeForBulkChangeType maps every known bulk change type", () => {
    expect(scopeForBulkChangeType("bulk_price_adjust")).toBe("write:prices");
    expect(scopeForBulkChangeType("bulk_set_availability")).toBe("write:availability");
    expect(scopeForBulkChangeType("bulk_set_category")).toBe("write:items");
    expect(scopeForBulkChangeType("bulk_tag")).toBe("write:items");
  });

  it("scopeForBulkChangeType defaults unknown change types to write:items", () => {
    expect(scopeForBulkChangeType("some_future_change_type")).toBe("write:items");
  });
});
