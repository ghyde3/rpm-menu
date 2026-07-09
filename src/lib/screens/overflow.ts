// Pure math for the §3.2 "Overflow rule": content that exceeds the screen
// either (a) auto-scales font down to a floor, then (b) paginates on a timed
// rotation (default 12s) — "never scrolls, never clips silently." Kept
// side-effect-free and DOM-free so it's directly vitest-able; the
// DOM-measuring glue (ResizeObserver, refs) lives in
// src/components/screens/useOverflowFit.ts and just calls into these.
//
// Approach: rather than iteratively stepping the font scale down and
// re-measuring (expensive re-render loop), `computeFitScale` solves for the
// exact scale in one shot from a single "natural height at scale 1"
// measurement, clamped to `FONT_SCALE_FLOOR`. If even the floor scale can't
// fit everything, `computeItemsPerPage` estimates how many items fit per
// page from the *average* natural item height (a deliberate approximation —
// real per-row heights would need per-item DOM refs threaded through the
// presentational template components, which §3.2 explicitly wants to stay
// simple "templates with knobs"), and `chunk` splits the item list into
// pages of that size for `useOverflowFit` to rotate through.

/** Never scale font below 60% — PRD §3.2's "floor" before pagination kicks in. */
export const FONT_SCALE_FLOOR = 0.6;

/** Default timed-pagination rotation interval, seconds (§3.2). */
export const DEFAULT_PAGINATION_INTERVAL_SECONDS = 12;

/**
 * Solves for the scale factor that makes `naturalHeight` fit exactly inside
 * `containerHeight`, clamped to `[floor, 1]`. Returns `1` for degenerate
 * (non-positive) inputs — i.e. "don't scale" rather than divide-by-zero.
 */
export function computeFitScale(naturalHeight: number, containerHeight: number, floor = FONT_SCALE_FLOOR): number {
  if (!(naturalHeight > 0) || !(containerHeight > 0)) return 1;
  const raw = containerHeight / naturalHeight;
  return Math.min(1, Math.max(floor, raw));
}

/** True when scaling all the way down to `floor` is enough to fit
 * `naturalHeight` inside `containerHeight` — i.e. pagination is NOT needed. */
export function contentFitsAtFloor(naturalHeight: number, containerHeight: number, floor = FONT_SCALE_FLOOR): boolean {
  if (!(naturalHeight > 0) || !(containerHeight > 0)) return true;
  return naturalHeight * floor <= containerHeight;
}

/**
 * Estimates how many items fit on one page once the screen is scaled to
 * `floor`, from the *average* per-item natural height (`naturalHeight /
 * itemCount`). Always returns at least 1 (a single, tall item still gets its
 * own page rather than vanishing) and never more than `itemCount`.
 */
export function computeItemsPerPage(
  naturalHeight: number,
  itemCount: number,
  containerHeight: number,
  floor = FONT_SCALE_FLOOR,
): number {
  if (itemCount <= 0) return 0;
  if (!(naturalHeight > 0) || !(containerHeight > 0)) return itemCount;
  const avgItemHeight = naturalHeight / itemCount;
  if (!(avgItemHeight > 0)) return itemCount;
  const capacity = containerHeight / floor;
  const perPage = Math.floor(capacity / avgItemHeight);
  return Math.max(1, Math.min(itemCount, perPage));
}

/** Splits `items` into consecutive pages of at most `size` — order-preserving
 * (manual/query-mode ordering is meaningful, §3.2). `size <= 0` returns the
 * whole list as one page rather than looping forever. Always returns at
 * least one (possibly empty) page so callers can safely index `pages[0]`. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length <= size) return [items];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}
