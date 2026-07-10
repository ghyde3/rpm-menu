// Pure filter/pagination logic for GET /api/v1/items (§3.7 "search/list
// items"). Kept dependency-free (no DB import) so it's cheaply unit-tested —
// the route handler loads rows via the existing `listItems`/tag-membership
// service calls and hands the plain arrays here.
import type { Item } from "@/db/schema";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface ItemsQueryParams {
  q?: string;
  categoryId?: string;
  tagId?: string;
  isAvailable?: boolean;
  pricingType?: string;
  limit: number;
  offset: number;
}

/** Parses `?q=&categoryId=&tagId=&isAvailable=&pricingType=&limit=&offset=`
 * off a request's search params, clamping `limit`/`offset` the same way
 * `listRecentChanges` (src/lib/service/revert.ts) does. */
export function parseItemsQuery(searchParams: URLSearchParams): ItemsQueryParams {
  const limitRaw = Number(searchParams.get("limit"));
  const offsetRaw = Number(searchParams.get("offset"));
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

  const isAvailableRaw = searchParams.get("isAvailable");

  return {
    q: searchParams.get("q")?.trim() || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    tagId: searchParams.get("tagId") || undefined,
    isAvailable: isAvailableRaw === null ? undefined : isAvailableRaw === "true",
    pricingType: searchParams.get("pricingType") || undefined,
    limit,
    offset,
  };
}

export interface FilterItemsOptions extends ItemsQueryParams {
  /** Item ids carrying `tagId`, when a `tagId` filter was requested. Ignored
   * (no-op filter) if `tagId` is unset. */
  itemIdsWithTag?: ReadonlySet<string>;
}

export interface FilterItemsResult {
  items: Item[];
  total: number;
}

/** Filters `allItems` by name/description/alias substring, category, tag
 * membership, availability, and pricing type, then pages the result.
 * `total` is the filtered (pre-page) count, for the response envelope's
 * pagination metadata. */
export function filterAndPageItems(allItems: readonly Item[], options: FilterItemsOptions): FilterItemsResult {
  const q = options.q?.toLowerCase();

  const filtered = allItems.filter((item) => {
    if (q) {
      // Mirrors src/app/admin/items/ItemsBrowser.tsx's client-side search
      // haystack: name + description + aliases, so seeded aliases (e.g.
      // "Weihenstephan" -> "Hefeweizen", "PBR" -> "Pabst") are actually
      // findable through this same query, not just the admin browser.
      const haystack = [item.name, item.description ?? "", ...item.aliases].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (options.categoryId && item.categoryId !== options.categoryId) return false;
    if (options.isAvailable !== undefined && item.isAvailable !== options.isAvailable) return false;
    if (options.pricingType && item.pricingType !== options.pricingType) return false;
    if (options.tagId && !(options.itemIdsWithTag ?? new Set()).has(item.id)) return false;
    return true;
  });

  const total = filtered.length;
  const page = filtered.slice(options.offset, options.offset + options.limit);
  return { items: page, total };
}
