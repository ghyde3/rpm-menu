// search_items, set_availability, update_item, list_86d (§3.7). Every
// handler calls the exact service functions the admin UI and REST API call
// (src/lib/service/items.ts) -- no parallel logic. `filterAndPageItems` is
// the same pure filter/paginate helper GET /api/v1/items uses
// (src/app/api/v1/_lib/items-query.ts) -- imported rather than reimplemented
// so "search" means the same thing on every surface.
import { eq } from "drizzle-orm";
import { itemTags } from "@/db/schema";
import { getItem, getItemTagIds, listItems, setItemAvailability, updateItem as updateItemService } from "@/lib/service/items";
import { filterAndPageItems } from "@/app/api/v1/_lib/items-query";
import { updateItemRequiresPriceScope } from "@/lib/api/scopes";
import { assertScope, type McpToolContext } from "../tool-helpers";
import type { SearchItemsArgs, SetAvailabilityArgs, UpdateItemArgs, List86dArgs } from "./schemas";

export async function searchItems(ctx: McpToolContext, args: SearchItemsArgs) {
  assertScope(ctx.scopes, "read");

  let itemIdsWithTag: Set<string> | undefined;
  if (args.tagId) {
    const rows = await ctx.db.select({ itemId: itemTags.itemId }).from(itemTags).where(eq(itemTags.tagId, args.tagId));
    itemIdsWithTag = new Set(rows.map((r) => r.itemId));
  }

  const allItems = await listItems(ctx.db);
  const { items, total } = filterAndPageItems(allItems, {
    q: args.q,
    categoryId: args.categoryId,
    tagId: args.tagId,
    isAvailable: args.isAvailable,
    pricingType: args.pricingType,
    limit: args.limit ?? 50,
    offset: args.offset ?? 0,
    itemIdsWithTag,
  });

  return { items, total, limit: args.limit ?? 50, offset: args.offset ?? 0 };
}

/** The "we're out of Coors" tool (§3.7's headline demo): single-item, one-
 * step -- no preview/apply dance, matching the product's trust model for
 * availability toggles. */
export async function setAvailability(ctx: McpToolContext, args: SetAvailabilityArgs) {
  assertScope(ctx.scopes, "write:availability");
  const item = await setItemAvailability(ctx.db, ctx.caller, args.itemId, { isAvailable: args.isAvailable });
  return { item };
}

export async function updateItem(ctx: McpToolContext, args: UpdateItemArgs) {
  // Mirrors PATCH /api/v1/items/:id (src/app/api/v1/items/[id]/route.ts):
  // write:items always required, write:prices escalates in on top of it
  // when the call touches priceCents/pricingType.
  assertScope(ctx.scopes, "write:items");
  const { itemId, ...rest } = args;
  if (updateItemRequiresPriceScope(rest)) {
    assertScope(ctx.scopes, "write:prices");
  }
  const item = await updateItemService(ctx.db, ctx.caller, itemId, rest);
  return { item };
}

/** "list_86d" -- everything currently unavailable, i.e. "what's 86'd right
 * now" (§3.7). Hardcodes `isAvailable: false`; see schemas.ts's doc comment
 * on why that filter isn't caller-suppliable. */
export async function list86d(ctx: McpToolContext, args: List86dArgs) {
  assertScope(ctx.scopes, "read");
  const allItems = await listItems(ctx.db);
  const { items, total } = filterAndPageItems(allItems, {
    q: args.q,
    categoryId: args.categoryId,
    isAvailable: false,
    limit: args.limit ?? 50,
    offset: args.offset ?? 0,
  });
  return { items, total, limit: args.limit ?? 50, offset: args.offset ?? 0 };
}

// Re-exported so tests/other tool modules can fetch a single item + its tag
// ids without importing src/lib/service/items directly (keeps the "only
// call service functions through this module" boundary tidy, though it's
// not itself one of the 9 spec'd tools).
export { getItem, getItemTagIds };
