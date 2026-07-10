// GET /api/display/pairing-code/:code (§3.3): TV polls this every few
// seconds while its pairing code is on screen. Unauthenticated (same posture
// as pairing-code creation) — the code itself is the short-lived secret,
// and only the poller holding it ever sees the minted token (see
// src/lib/service/displays.ts's `pollPairingCode` doc for the exactly-once
// issuance design).
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { pollPairingCode } from "@/lib/service/displays";
import { getClientIp, rateLimitOrThrow, errorResponse } from "../../_lib";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    await rateLimitOrThrow(`display-pairing-poll:${getClientIp(req)}`, 60, 60);
    const result = await pollPairingCode(db, code.toUpperCase());
    const status = result.status === "not_found" ? 404 : result.status === "expired" ? 410 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    return errorResponse(err);
  }
}
