// POST /api/v1/price-adjustments — price-adjust dry run (§3.7 "adjust prices
// (dry-run + apply)"). Creates a `pending_changes` row via the shared
// bulk-ops preview path (`changeType: "bulk_price_adjust"`) and returns the
// diff + pending-change id; nothing is written to `items` yet. Apply is the
// generic POST /api/v1/pending-changes/:id/confirm endpoint — the two-step
// shape PRD §3.7/§4.1 mandates for price/bulk/destructive operations. Scope:
// write:prices (bulk price adjust is owner-only in the admin UI — mirrored
// here as the narrowest scope, matching bulk-ops.ts's
// requireRoleForChangeType).
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { previewBulkOperation } from "@/lib/service/bulk-ops";
import { apiErrorResponse, readJsonBody } from "../_lib/http";

export async function POST(req: NextRequest) {
  try {
    const { caller } = await authenticateApiRequest(db, req, { scope: "write:prices" });
    const body = await readJsonBody(req);
    const input = {
      ...(typeof body === "object" && body ? body : {}),
      changeType: "bulk_price_adjust" as const,
    };
    const preview = await previewBulkOperation(db, caller, input);
    return NextResponse.json({ preview }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
