// GET /api/v1/pending-changes/:id — read one pending change (§3.7). Scope:
// read.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { getPendingChange } from "@/lib/service/pending-changes";
import { apiErrorResponse } from "../../_lib/http";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authenticateApiRequest(db, req, { scope: "read" });
    const { id } = await params;
    const pendingChange = await getPendingChange(db, id);
    return NextResponse.json({ pendingChange });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
