// Regression test for the Zod v4 `.partial()` + `.default(...)` silent-reset
// bug (see screens.ts's `updateScreenSchema` block comment). `minSelect`/
// `isRequired`/`sortOrder` must be truly ABSENT from
// `updateModifierGroupSchema`'s parsed output when omitted from the input,
// not reset to their create-time defaults.
//
// `updateModifierOptionSchema` in this same file was already written with
// explicit `.optional()` fields and no `.default(...)` — it's asserted here
// too, purely to confirm it stays correct, not because it needed a fix.
import { describe, expect, it } from "vitest";
import { updateModifierGroupSchema, updateModifierOptionSchema } from "./modifiers";

describe("updateModifierGroupSchema", () => {
  it("omits minSelect/isRequired/sortOrder when not supplied, rather than defaulting them", () => {
    const parsed = updateModifierGroupSchema.parse({ name: "Toppings" });
    expect(parsed).toEqual({ name: "Toppings" });
    expect("minSelect" in parsed).toBe(false);
    expect("isRequired" in parsed).toBe(false);
    expect("sortOrder" in parsed).toBe(false);
    expect("selectionType" in parsed).toBe(false);
  });

  it("still accepts and validates every field when explicitly supplied", () => {
    const parsed = updateModifierGroupSchema.parse({
      minSelect: 2,
      isRequired: true,
      sortOrder: 4,
    });
    expect(parsed).toEqual({ minSelect: 2, isRequired: true, sortOrder: 4 });
  });

  it("accepts an empty object (no-op update)", () => {
    expect(updateModifierGroupSchema.parse({})).toEqual({});
  });
});

describe("updateModifierOptionSchema (already correct, no fix needed)", () => {
  it("omits sortOrder/isAvailable when not supplied — was never defaulted, still isn't", () => {
    const parsed = updateModifierOptionSchema.parse({ label: "Extra cheese" });
    expect(parsed).toEqual({ label: "Extra cheese" });
    expect("sortOrder" in parsed).toBe(false);
    expect("isAvailable" in parsed).toBe(false);
  });
});
