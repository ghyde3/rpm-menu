// preview_price_adjustment, apply_pending_change (§3.7's two-step bulk/
// price/destructive flow). Both call straight into
// src/lib/service/bulk-ops.ts / pending-changes.ts -- the exact functions
// POST /api/v1/price-adjustments and POST /api/v1/pending-changes/:id/confirm
// call. The AI client physically cannot skip the preview: `apply_pending_change`
// only ever receives a `pendingChangeId` that `preview_price_adjustment`
// itself returned (a server-issued `pending_changes.id`), and
// `applyBulkOperation` -> `getFreshPendingChangeOrThrow` rejects anything
// expired/already-applied/cancelled/unknown.
import { applyBulkOperation, previewBulkOperation } from "@/lib/service/bulk-ops";
import { getPendingChange } from "@/lib/service/pending-changes";
import { hasScope, scopeForBulkChangeType } from "@/lib/api/scopes";
import { assertScope, McpScopeError, type McpToolContext } from "../tool-helpers";
import type { PreviewPriceAdjustmentArgs, ApplyPendingChangeArgs } from "./schemas";

/** Mirrors POST /api/v1/price-adjustments: bulk price-adjust is owner-only
 * in the admin UI, so `write:prices` is the narrowest matching scope here
 * too (bulk-ops.ts's `requireRoleForChangeType` is a no-op for our
 * pre-authorized `system` actor -- this scope check is what actually gates
 * it for MCP/API callers). */
export async function previewPriceAdjustment(ctx: McpToolContext, args: PreviewPriceAdjustmentArgs) {
  assertScope(ctx.scopes, "write:prices");
  const preview = await previewBulkOperation(ctx.db, ctx.caller, {
    changeType: "bulk_price_adjust" as const,
    itemIds: args.itemIds,
    mode: args.mode,
    amountCents: args.amountCents,
    percent: args.percent,
  });
  return { preview };
}

/** Mirrors POST /api/v1/pending-changes/:id/confirm: the scope required
 * depends on *what* the pending change actually does, which isn't known
 * until it's loaded -- so there's no static `assertScope` call up front for
 * this tool (a key scoped only to e.g. `write:prices` can still preview+
 * apply a price adjustment without also being granted `read`). */
export async function applyPendingChange(ctx: McpToolContext, args: ApplyPendingChangeArgs) {
  const pending = await getPendingChange(ctx.db, args.pendingChangeId);
  const requiredScope = scopeForBulkChangeType(pending.changeType);
  if (!hasScope(ctx.scopes, requiredScope)) {
    throw new McpScopeError(`API key is missing required scope(s): ${requiredScope}`);
  }
  const result = await applyBulkOperation(ctx.db, ctx.caller, args.pendingChangeId);
  return { result };
}
