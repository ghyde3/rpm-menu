// GET /api/v1/pending-changes — list pending changes (§3.7). Scope: read.
// Optional `?status=&changeType=` filters, mirroring
// src/lib/service/pending-changes.ts's `ListPendingChangesFilter`.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { pendingChangeStatusEnum, type PendingChangeStatus } from "@/db/schema";
import { authenticateApiRequest } from "@/lib/api/auth-middleware";
import { listPendingChanges } from "@/lib/service/pending-changes";
import { apiErrorResponse } from "../_lib/http";

function parseStatus(raw: string | null): PendingChangeStatus | undefined {
  if (!raw) return undefined;
  return (pendingChangeStatusEnum as readonly string[]).includes(raw)
    ? (raw as PendingChangeStatus)
    : undefined;
}

export async function GET(req: NextRequest) {
  try {
    await authenticateApiRequest(db, req, { scope: "read" });
    const status = parseStatus(req.nextUrl.searchParams.get("status"));
    const changeType = req.nextUrl.searchParams.get("changeType") ?? undefined;
    const pendingChanges = await listPendingChanges(db, { status, changeType });
    return NextResponse.json({ pendingChanges });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
