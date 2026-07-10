// Regression test for the Zod v4 `.partial()` + `.default(...)` silent-reset
// bug (see screens.ts's `updateScreenSchema` block comment). `visibility`
// must be truly ABSENT from `updateTagSchema`'s parsed output when omitted
// from the input, not reset to its create-time default ("private").
import { describe, expect, it } from "vitest";
import { updateTagSchema } from "./tags";

describe("updateTagSchema", () => {
  it("omits visibility when not supplied, rather than defaulting it", () => {
    const parsed = updateTagSchema.parse({ color: "#00ff00" });
    expect(parsed).toEqual({ color: "#00ff00" });
    expect("visibility" in parsed).toBe(false);
  });

  it("still accepts and validates visibility when explicitly supplied", () => {
    const parsed = updateTagSchema.parse({ visibility: "public" });
    expect(parsed).toEqual({ visibility: "public" });
  });

  it("accepts an empty object (no-op update)", () => {
    expect(updateTagSchema.parse({})).toEqual({});
  });
});
