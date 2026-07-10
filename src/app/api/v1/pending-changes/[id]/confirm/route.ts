// POST /api/v1/pending-changes/:id/confirm — the "apply" half of the
// preview->apply flow (§3.7/§4.1). The scope required depends on *what* the
// pending change actually does (bulk price adjust needs write:prices, a
// bulk availability toggle needs write:availability, etc — see
// scopeForBulkChangeType), which isn't known until the row is loaded. So
// this authenticates with no scope requirement of its own (`scope: []` —
// just "this is a live, non-revoked key", which also covers rate-limit +
// last-used bookkeeping) first, then checks the change-type-specific scope
// by hand once the pending row is loaded, before calling into
// `applyBulkOperation` — which itself re-validates freshness/role (a no-op
// role check for our "system" actor, since isPreAuthorizedElsewhere already
// covers non-user actors; the scope check here is what actually gates it).
// This deliberately does NOT require a blanket `read` scope: a key scoped
// only to e.g. `write:prices` can still preview+confirm a price adjustment
// end to end without also being granted `read`.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { ApiAuthError, authenticateApiRequest } from "@/lib/api/auth-middleware";
import { hasScope, scopeForBulkChangeType } from "@/lib/api/scopes";
import { applyBulkOperation } from "@/lib/service/bulk-ops";
import { getPendingChange } from "@/lib/service/pending-changes";
import { apiErrorResponse } from "../../../_lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { caller, scopes } = await authenticateApiRequest(db, req, { scope: [] });
    const { id } = await params;

    const pending = await getPendingChange(db, id);
    const requiredScope = scopeForBulkChangeType(pending.changeType);
    if (!hasScope(scopes, requiredScope)) {
      throw new ApiAuthError(403, `API key is missing required scope(s): ${requiredScope}`);
    }

    const result = await applyBulkOperation(db, caller, id);
    return NextResponse.json({ result });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
