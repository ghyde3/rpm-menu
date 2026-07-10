// POST /api/display/pairing-code (§3.3): TV calls this on first load when it
// has no token in localStorage — generates a fresh 6-character pairing code
// to show on screen. Unauthenticated (a code alone grants nothing; claiming
// it requires an authenticated owner session — see displays.ts's module
// header for the full pairing-token handoff design).
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { createPairingCode } from "@/lib/service/displays";
import { getClientIp, rateLimitOrThrow, errorResponse } from "../_lib";

export async function POST(req: NextRequest) {
  try {
    // Generous but bounded: a kiosk retrying on wifi flap shouldn't get
    // stuck, but this endpoint has no other gate at all, so cap it.
    await rateLimitOrThrow(`display-pairing-create:${getClientIp(req)}`, 300, 20);
    const { code, expiresAt } = await createPairingCode(db);
    return NextResponse.json({ code, expiresAt });
  } catch (err) {
    return errorResponse(err);
  }
}
