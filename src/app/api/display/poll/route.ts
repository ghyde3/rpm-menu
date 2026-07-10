// GET /api/display/poll (§3.3, §5.2): the TV's runtime loop. Auth via
// `?displayId=<uuid>` + `Authorization: Bearer <token>` (token verified
// against the display's hashed token — see displays.ts's `verifyDisplayAuth`).
// Lightweight version check via ETag/If-None-Match (§3.3: "poll every 15-30s
// with a lightweight version check (ETag or version number); re-render only
// on change") — a 304 short-circuits before any content resolution runs.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { verifyDisplayAuth, recordHeartbeat, getCurrentScreenForDisplay } from "@/lib/service/displays";
import { resolveScreenContent } from "@/lib/screens/resolve";
import { rateLimitOrThrow, errorResponse, ApiError } from "../_lib";

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function GET(req: NextRequest) {
  try {
    const displayId = req.nextUrl.searchParams.get("displayId");
    const token = extractBearerToken(req);
    if (!displayId || !token) {
      throw new ApiError(401, 'Missing "displayId" query param or Bearer token.');
    }

    // Rate-limit per display (not per IP) — a single flaky TV retrying
    // aggressively shouldn't lock out others, and a display's own token is
    // already the auth gate.
    await rateLimitOrThrow(`display-poll:${displayId}`, 300, 120);

    const display = await verifyDisplayAuth(db, displayId, token);
    if (!display) {
      // Covers "not found," "revoked," and "hash mismatch" uniformly (§3.3:
      // "Revoking a token blanks that TV to a re-pair screen on its next
      // poll") — the client treats any 401 here as "clear localStorage and
      // go back to /display."
      throw new ApiError(401, "Invalid, revoked, or unrecognized display token.");
    }

    await recordHeartbeat(db, displayId);

    const { screenId, matchedRuleId } = await getCurrentScreenForDisplay(db, displayId);
    if (!screenId) {
      return NextResponse.json(
        { screenId: null, version: 0, matchedRuleId: null, resolved: null },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const resolved = await resolveScreenContent(db, screenId);
    const etag = `"${screenId}-${resolved.screen.version}"`;

    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      { screenId, version: resolved.screen.version, matchedRuleId, resolved },
      { status: 200, headers: { ETag: etag, "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
