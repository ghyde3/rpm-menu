// REST API authentication (§3.7): `Authorization: Bearer <api key>` ->
// hashed lookup against `api_keys` -> scope check -> per-key rate limit ->
// `last_used_at` bump. Runs BEFORE any service-layer call, per
// docs/architecture.md's "system ... actors are pre-authorized by their
// surface ... BEFORE calling services" contract — service functions never
// re-check role/scope for `actor.type === "system"`
// (`isPreAuthorizedElsewhere` in src/lib/service/base/caller.ts short-
// circuits for them), so this module is the *only* enforcement point for API
// key requests.
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import type { Database } from "@/db";
import { apiKeys, type ApiKeyScope } from "@/db/schema";
import { hashApiKey } from "@/lib/api-keys/hash";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ServiceCaller } from "@/lib/service/base";
import { hasScope } from "./scopes";

export class ApiAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}

export interface AuthenticatedApiCall {
  apiKeyId: string;
  apiKeyName: string;
  scopes: ApiKeyScope[];
  caller: ServiceCaller;
}

export interface AuthenticateOptions {
  /** Scope(s) required for this endpoint. All must be present (AND
   * semantics) — used e.g. by the update-item endpoint when the body also
   * touches a price field. */
  scope: ApiKeyScope | ApiKeyScope[];
  /** Overridable for tests only; production call sites use the default. */
  rateLimit?: { windowSeconds: number; limit: number };
}

/** 120 requests/minute per key — generous enough for a chat-adapter or MCP
 * client driving normal admin workflows, tight enough to bound a runaway/
 * adversarial client per PRD §3.7's "worst case is bounded by scopes + rate
 * limits" posture. */
const DEFAULT_RATE_LIMIT = { windowSeconds: 60, limit: 120 };

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Authenticates one REST API request end to end. Throws `ApiAuthError` (401
 * missing/invalid/revoked key, 403 insufficient scope, 429 rate limited) —
 * route handlers catch this the same way they catch service-layer errors
 * (`NotFoundError`/`ConflictError`/`AuthError`). On success, bumps
 * `last_used_at` and returns a ready-to-use `ServiceCaller`
 * (`actor: {type: "system", id: <api_keys.id>}, surface: "api"`) per
 * docs/architecture.md's actor-attribution convention.
 */
export async function authenticateApiRequest(
  db: Database,
  req: NextRequest,
  options: AuthenticateOptions,
): Promise<AuthenticatedApiCall> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiAuthError(401, 'Missing or malformed Authorization header (expected "Bearer <key>")');
  }

  const hash = hashApiKey(token);
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash));
  if (!key || key.revokedAt) {
    throw new ApiAuthError(401, "Invalid or revoked API key");
  }

  const required = Array.isArray(options.scope) ? options.scope : [options.scope];
  const missing = required.filter((scope) => !hasScope(key.scopes, scope));
  if (missing.length > 0) {
    throw new ApiAuthError(403, `API key is missing required scope(s): ${missing.join(", ")}`);
  }

  // Bump last-used as soon as the key itself is validated + authorized —
  // rate limiting below governs whether the request is *served*, not
  // whether the key was *used*.
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

  const rl = options.rateLimit ?? DEFAULT_RATE_LIMIT;
  const rateLimitResult = await checkRateLimit(db, {
    key: `api-key:${key.id}`,
    windowSeconds: rl.windowSeconds,
    limit: rl.limit,
  });
  if (!rateLimitResult.allowed) {
    throw new ApiAuthError(
      429,
      `Rate limit exceeded (${rateLimitResult.limit} requests / ${rl.windowSeconds}s)`,
    );
  }

  return {
    apiKeyId: key.id,
    apiKeyName: key.name,
    scopes: key.scopes as ApiKeyScope[],
    caller: { actor: { type: "system", id: key.id }, surface: "api" },
  };
}
