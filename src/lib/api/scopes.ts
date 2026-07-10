// API key scope model (PRD §3.7/§3.8). The scope *values* are the
// foundation-owned `apiKeys.ts` schema's `API_KEY_SCOPES` — this file is
// where the REST surface decides which scope a given operation requires,
// including ambiguous cases where a single endpoint's *effect* depends on
// its body (an "update item" call that also sets a price field needs
// write:prices on top of write:items, mirroring the service layer's
// touchesPriceFields escalation in src/lib/service/items.ts, which is a
// private, unexported function there — this is the REST-surface's own copy
// of that rule, not a shared import, since that unit's owns_paths don't
// include this file).
//
// Per §3.8: no `settings-write` scope exists anywhere in Phase 1 — nothing
// in this file ever names one.
import { API_KEY_SCOPES, type ApiKeyScope } from "@/db/schema";
import type { BulkChangeType } from "@/lib/service/bulk-ops";

export { API_KEY_SCOPES };
export type { ApiKeyScope };

export function hasScope(scopes: readonly string[], required: ApiKeyScope): boolean {
  return scopes.includes(required);
}

export function hasAllScopes(scopes: readonly string[], required: readonly ApiKeyScope[]): boolean {
  return required.every((scope) => scopes.includes(scope));
}

/** Mirrors items.ts's private `touchesPriceFields`: an /items/:id PATCH body
 * that sets `priceCents`/`pricingType` needs `write:prices` in addition to
 * `write:items`, exactly like a "user" actor needs the owner role for the
 * same fields (PRD §2: staff/scoped-keys cannot change prices). */
export function updateItemRequiresPriceScope(rawInput: {
  priceCents?: unknown;
  pricingType?: unknown;
}): boolean {
  return rawInput.priceCents !== undefined || rawInput.pricingType !== undefined;
}

/**
 * Bulk-op change types map to the scope that governs their *apply* step —
 * translated from `bulk-ops.ts`'s `requireRoleForChangeType` (owner vs.
 * staff-or-owner) into the REST scope model (owner-only price changes ->
 * `write:prices`, everything else -> its natural write scope). Used by the
 * generic `/pending-changes/:id/confirm` endpoint, which doesn't know the
 * change type until it loads the pending row.
 */
export function scopeForBulkChangeType(changeType: BulkChangeType | string): ApiKeyScope {
  switch (changeType) {
    case "bulk_price_adjust":
      return "write:prices";
    case "bulk_set_availability":
      return "write:availability";
    case "bulk_set_category":
    case "bulk_tag":
      return "write:items";
    default:
      return "write:items";
  }
}
