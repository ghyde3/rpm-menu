// PATCH /api/v1/items/:id/availability — the "86 it" toggle (§3.7). Scope:
// write:availability.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { setItemAvailability } from "@/lib/service/items";
import { apiErrorResponse, readJsonBody } from "../../../_lib/http";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { caller } = await authenticateApiRequest(db, req, { scope: "write:availability" });
    const body = await readJsonBody(req);
    const { id } = await params;
    const updated = await setItemAvailability(db, caller, id, body as Parameters<typeof setItemAvailability>[3]);
    return NextResponse.json({ item: updated });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
