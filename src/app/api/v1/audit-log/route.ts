// GET /api/v1/audit-log — the "Recent changes" feed (§3.5/§3.7 "audit log
// read"), filterable by actor/entity type. Scope: read.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { ENTITY_TYPES, type EntityType } from "@/db/schema";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { listRecentChanges } from "@/lib/service/revert";
import { apiErrorResponse } from "../_lib/http";

function parseEntityType(raw: string | null): EntityType | undefined {
  if (!raw) return undefined;
  return (ENTITY_TYPES as readonly string[]).includes(raw) ? (raw as EntityType) : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { caller } = await authenticateApiRequest(db, req, { scope: "read" });
    const params = req.nextUrl.searchParams;
    const limitRaw = Number(params.get("limit"));
    const offsetRaw = Number(params.get("offset"));

    const entries = await listRecentChanges(db, caller, {
      actorId: params.get("actorId") ?? undefined,
      entityType: parseEntityType(params.get("entityType")),
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
      offset: Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : undefined,
    });

    return NextResponse.json({ entries });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
