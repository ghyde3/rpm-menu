// Shared error->HTTP mapping for every /api/v1/** route handler, so each
// route's catch block is one line instead of re-deriving status codes.
// Handles the REST-surface's own `ApiAuthError` plus every service-layer
// error type a wrapped service function can throw.
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiAuthError } from "@/lib/api/auth-middleware";

interface StatusfulError {
  status: number;
  message: string;
}

function isStatusfulError(err: unknown): err is StatusfulError {
  return (
    !!err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number" &&
    err instanceof Error
  );
}

/** Maps a thrown error to a JSON `NextResponse` with the right status code.
 * Covers: `ApiAuthError` (401/403/429), Zod validation errors (400),
 * `NotFoundError`/`ConflictError`/`AuthError` (each carries its own
 * `.status`), and falls back to 500 for anything unrecognized. */
export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: err.issues },
      { status: 400 },
    );
  }
  if (isStatusfulError(err)) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[api/v1] unhandled error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Parses a request body as JSON, throwing a 400-shaped error the same way
 * `apiErrorResponse` understands rather than letting a raw SyntaxError leak
 * out as an unhandled 500. Returns `{}` for an empty body (some endpoints,
 * e.g. confirm/apply, take no body). */
export async function readJsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("Request body must be valid JSON") as Error & { status: number };
    err.status = 400;
    throw err;
  }
}
