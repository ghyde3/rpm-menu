// PUT /api/v1/items/:id/tags — full-replace an item's tag set (§3.7 "manage
// tags on items"). Scope: write:items.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { setItemTags } from "@/lib/service/items";
import { apiErrorResponse, readJsonBody } from "../../../_lib/http";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { caller } = await authenticateApiRequest(db, req, { scope: "write:items" });
    const body = await readJsonBody(req);
    const { id } = await params;
    const tagIds = await setItemTags(db, caller, id, body as Parameters<typeof setItemTags>[3]);
    return NextResponse.json({ tagIds });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
