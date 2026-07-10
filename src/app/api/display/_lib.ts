// Shared helpers for the /api/display/** route handlers (not itself a route
// — Next.js only treats `route.ts`/`route.tsx` files specially, so this
// plain `.ts` file under the same owns_path is safe to import from siblings
// without becoming an extra endpoint).
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { NotFoundError, ConflictError } from "@/lib/service/base/errors";
import { AuthError } from "@/lib/auth/role-guard";

/** Best-effort client IP for rate-limiting unauthenticated display routes
 * (§3.6: "Public menu and display routes: no auth, but rate-limited").
 * `x-forwarded-for` may carry a comma-separated proxy chain; the first entry
 * is the original client. Falls back to a shared bucket key when no header
 * is present (e.g. local dev without a proxy) rather than throwing. */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function rateLimitOrThrow(key: string, windowSeconds: number, limit: number): Promise<void> {
  const result = await checkRateLimit(db, { key, windowSeconds, limit });
  if (!result.allowed) {
    throw new ApiError(429, `Rate limited — retry in ${result.retryAfterSeconds}s.`);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Maps every error shape this unit's service functions throw (ApiError,
 * AuthError, NotFoundError, ConflictError from src/lib/service/base/errors,
 * or a bare Zod/Error) to a JSON response — mirrors src/app/api/upload/
 * route.ts's `errorStatus`/`errorMessage` pattern. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err && typeof err === "object" && "issues" in err) {
    // ZodError shape.
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
