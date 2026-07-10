// GET /api/v1/items/:id — single item read (scope: read).
// PATCH /api/v1/items/:id — update item (§3.7). Scope: write:items, plus
// write:prices when the body touches priceCents/pricingType (mirrors
// items.ts's touchesPriceFields owner-escalation for "user" actors — see
// src/lib/api/scopes.ts's doc comment).
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { ApiAuthError, authenticateApiRequest } from "@/lib/api/auth-middleware";
import { hasScope, updateItemRequiresPriceScope } from "@/lib/api/scopes";
import { getItem, getItemTagIds, updateItem } from "@/lib/service/items";
import { apiErrorResponse, readJsonBody } from "../../_lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authenticateApiRequest(db, _req, { scope: "read" });
    const { id } = await params;
    const item = await getItem(db, id);
    const tagIds = await getItemTagIds(db, id);
    return NextResponse.json({ item: { ...item, tagIds } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Auth first (base `write:items` requirement) so an unauthenticated/
    // under-scoped caller never gets far enough to have their request body
    // parsed and validated — mirrors the confirm route's "authenticate,
    // then check the operation-specific scope against what auth already
    // resolved" pattern rather than reading the body before proving identity.
    const { caller, scopes } = await authenticateApiRequest(db, req, { scope: "write:items" });
    const body = await readJsonBody(req);

    if (
      body &&
      typeof body === "object" &&
      updateItemRequiresPriceScope(body as { priceCents?: unknown; pricingType?: unknown }) &&
      !hasScope(scopes, "write:prices")
    ) {
      throw new ApiAuthError(403, "API key is missing required scope(s): write:prices");
    }

    const { id } = await params;
    const updated = await updateItem(db, caller, id, body as Parameters<typeof updateItem>[3]);
    return NextResponse.json({ item: updated });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
