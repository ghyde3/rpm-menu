"use client";

// DOM-measuring glue for the §3.2 "Overflow rule". The actual math
// (scale-solving, page-size estimation, chunking) is pure and lives in
// src/lib/screens/overflow.ts so it's vitest-able without a real layout
// engine; this hook just wires that math to two refs:
//
//   - `measureRef` — a hidden (visibility:hidden, position:absolute) layer
//     that always renders the FULL item list at natural (scale-1) size, used
//     only to read `scrollHeight`. CSS transforms don't affect
//     scrollHeight/clientHeight, so this measurement stays valid regardless
//     of whatever scale the *visible* layer ends up using.
//   - `containerRef` — the 16:9 (or full-viewport, on the eventual TV route)
//     frame; its `clientHeight` is the available space.
//
// Re-measures on ResizeObserver (container resize, e.g. the admin preview's
// responsive frame) and whenever `items` changes (a poll picked up new
// content). Rotates pages on a `setInterval` per
// `display_options.paginationIntervalSeconds`.
import * as React from "react";
import {
  FONT_SCALE_FLOOR,
  computeFitScale,
  contentFitsAtFloor,
  computeItemsPerPage,
  chunk,
} from "@/lib/screens/overflow";

export interface OverflowFitResult<T> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  measureRef: React.RefObject<HTMLDivElement | null>;
  /** Scale factor to apply to the visible layer (`transform: scale(...)`, 1 = no scaling). */
  scale: number;
  /** The slice of `items` to render on the visible layer right now. */
  pageItems: T[];
  pageIndex: number;
  pageCount: number;
}

export function useOverflowFit<T>(items: T[], paginationIntervalSeconds: number): OverflowFitResult<T> {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const measureRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);
  const [pages, setPages] = React.useState<T[][]>([items]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const recompute = React.useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const containerHeight = container.clientHeight;
    const naturalHeight = measure.scrollHeight;

    if (containerHeight <= 0 || naturalHeight <= containerHeight) {
      setScale(1);
      setPages([items]);
      setPageIndex(0);
      return;
    }
    if (contentFitsAtFloor(naturalHeight, containerHeight)) {
      setScale(computeFitScale(naturalHeight, containerHeight));
      setPages([items]);
      setPageIndex(0);
      return;
    }
    setScale(FONT_SCALE_FLOOR);
    const perPage = computeItemsPerPage(naturalHeight, items.length, containerHeight);
    setPages(chunk(items, perPage));
    setPageIndex(0);
    // `items` is compared by the caller re-creating this callback each render
    // it changes identity on — that's fine, effects below depend on
    // `recompute`'s identity via useCallback's own dep array.
  }, [items]);

  React.useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute]);

  React.useEffect(() => {
    if (pages.length <= 1) return;
    const intervalMs = Math.max(3, paginationIntervalSeconds) * 1000;
    const id = setInterval(() => {
      setPageIndex((i) => (i + 1) % pages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [pages, paginationIntervalSeconds]);

  return {
    containerRef,
    measureRef,
    scale,
    pageItems: pages[pageIndex] ?? items,
    pageIndex,
    pageCount: pages.length,
  };
}
