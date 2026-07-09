import { describe, expect, it } from "vitest";
import {
  FONT_SCALE_FLOOR,
  computeFitScale,
  contentFitsAtFloor,
  computeItemsPerPage,
  chunk,
} from "./overflow";

describe("computeFitScale", () => {
  it("returns 1 when content already fits", () => {
    expect(computeFitScale(400, 800)).toBe(1);
  });

  it("solves the exact scale needed to fit (when the needed scale is above the floor)", () => {
    // 500 tall content in a 400-tall container -> needs 80% scale, which is
    // above the 60% floor, so no clamping kicks in.
    expect(computeFitScale(500, 400)).toBeCloseTo(0.8, 5);
  });

  it("clamps to the floor rather than shrinking further", () => {
    // Would need 20% to fit, but floor is 60%.
    expect(computeFitScale(2000, 400)).toBe(FONT_SCALE_FLOOR);
  });

  it("treats non-positive inputs as 'do not scale'", () => {
    expect(computeFitScale(0, 400)).toBe(1);
    expect(computeFitScale(400, 0)).toBe(1);
    expect(computeFitScale(-10, 400)).toBe(1);
  });
});

describe("contentFitsAtFloor", () => {
  it("is true when content already fits without scaling", () => {
    expect(contentFitsAtFloor(400, 800)).toBe(true);
  });

  it("is true right up to the floor boundary", () => {
    // At floor scale (0.6), 600-tall content needs exactly 360 of container
    // height (600 * 0.6 = 360) — comfortably inside a 400-tall container.
    expect(contentFitsAtFloor(600, 400)).toBe(true);
  });

  it("is false when even the floor scale isn't enough", () => {
    expect(contentFitsAtFloor(2000, 400)).toBe(false);
  });
});

describe("computeItemsPerPage", () => {
  it("returns the full count when there's no overflow data", () => {
    expect(computeItemsPerPage(0, 10, 400)).toBe(10);
    expect(computeItemsPerPage(100, 10, 0)).toBe(10);
  });

  it("estimates capacity from the average item height at floor scale", () => {
    // 10 items, natural height 1000 -> avg 100/item. Floor 0.6, container 300
    // -> capacity = 300/0.6 = 500 -> 5 items/page.
    expect(computeItemsPerPage(1000, 10, 300)).toBe(5);
  });

  it("never returns less than 1 even for a single very tall item", () => {
    expect(computeItemsPerPage(5000, 1, 100)).toBe(1);
  });

  it("never returns more than the total item count", () => {
    expect(computeItemsPerPage(10, 3, 10_000)).toBe(3);
  });

  it("returns 0 for an empty item list", () => {
    expect(computeItemsPerPage(0, 0, 400)).toBe(0);
  });
});

describe("chunk", () => {
  it("splits into pages of the given size, preserving order", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single page when everything fits", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("returns a single (possibly empty) page for a non-positive size", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunk([], 0)).toEqual([[]]);
  });

  it("handles an empty list", () => {
    expect(chunk([], 5)).toEqual([[]]);
  });
});
