// GET /api/v1/screens/:id — single screen read (scope: read).
// PATCH /api/v1/screens/:id — update screen (§3.7). Scope: write:screens.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { getScreen, updateScreen } from "@/lib/service/screens";
import { apiErrorResponse, readJsonBody } from "../../_lib/http";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authenticateApiRequest(db, req, { scope: "read" });
    const { id } = await params;
    const screen = await getScreen(db, id);
    return NextResponse.json({ screen });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { caller } = await authenticateApiRequest(db, req, { scope: "write:screens" });
    const body = await readJsonBody(req);
    const { id } = await params;
    const updated = await updateScreen(db, caller, id, body as Parameters<typeof updateScreen>[3]);
    return NextResponse.json({ screen: updated });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
