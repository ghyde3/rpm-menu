// Regression test for the Zod v4 `.partial()` + `.default(...)` silent-reset
// bug (see screens.ts's `updateScreenSchema` block comment). `sortOrder`/
// `displayConfig` must be truly ABSENT from `updateCategorySchema`'s parsed
// output when omitted from the input, not reset to their create-time
// defaults.
import { describe, expect, it } from "vitest";
import { updateCategorySchema } from "./categories";

describe("updateCategorySchema", () => {
  it("omits sortOrder/displayConfig when not supplied, rather than defaulting them", () => {
    const parsed = updateCategorySchema.parse({ name: "Sides" });
    expect(parsed).toEqual({ name: "Sides" });
    expect("sortOrder" in parsed).toBe(false);
    expect("displayConfig" in parsed).toBe(false);
    expect("type" in parsed).toBe(false);
  });

  it("still accepts and validates every field when explicitly supplied", () => {
    const parsed = updateCategorySchema.parse({
      sortOrder: 7,
      displayConfig: { showBadges: true },
    });
    expect(parsed).toEqual({ sortOrder: 7, displayConfig: { showBadges: true } });
  });

  it("accepts an empty object (no-op update)", () => {
    expect(updateCategorySchema.parse({})).toEqual({});
  });
});
