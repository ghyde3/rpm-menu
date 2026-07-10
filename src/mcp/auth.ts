// MCP server startup auth (spec: "the server process is launched with an API
// key in env (MCP_API_KEY); validate it at startup against the api_keys
// table and derive scopes from it; actor.type='system', actor.id=<api_keys
// row id>, surface='mcp'"). Mirrors src/lib/api/auth-middleware.ts's
// `authenticateApiRequest` request-time flow, adapted to a one-shot,
// connect-time check: there is no per-request Authorization header on a
// stdio MCP connection -- the whole server process authenticates as exactly
// one key for its lifetime, so this runs once, before the transport
// connects, rather than per tool call. Per-call scope checks still happen
// per tool (src/mcp/tool-helpers.ts) exactly like the REST route handlers.
import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { apiKeys, type ApiKeyScope } from "@/db/schema";
import { hashApiKey } from "@/lib/api-keys/hash";
import type { ServiceCaller } from "@/lib/service/base";

export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}

export interface McpIdentity {
  apiKeyId: string;
  apiKeyName: string;
  scopes: ApiKeyScope[];
  caller: ServiceCaller;
}

/**
 * Validates `MCP_API_KEY` (passed in) against `api_keys`, throwing
 * `McpAuthError` with an actionable message for every failure mode (missing
 * env var, unknown/revoked key). On success, bumps `last_used_at` once (the
 * per-request bump `authenticateApiRequest` does doesn't apply to a
 * long-lived stdio connection) and returns the derived identity: scopes
 * straight off the row, and a ready-to-use `ServiceCaller` with
 * `actor.type = "system"`, `actor.id = <api_keys row id>`,
 * `surface = "mcp"` -- the same actor-attribution convention
 * docs/architecture.md defines for REST API keys, with `surface` swapped.
 */
export async function authenticateMcpServer(db: Database, plaintextKey: string | undefined): Promise<McpIdentity> {
  if (!plaintextKey || !plaintextKey.trim()) {
    throw new McpAuthError(
      "MCP_API_KEY environment variable is not set. Launch this server with a valid API key " +
        "created in the admin UI's Settings > API Keys (e.g. `MCP_API_KEY=rpm_... npm run mcp`).",
    );
  }

  const hash = hashApiKey(plaintextKey);
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash));
  if (!key) {
    throw new McpAuthError("MCP_API_KEY does not match any known API key. Check the key value and try again.");
  }
  if (key.revokedAt) {
    throw new McpAuthError(
      `API key "${key.name}" (id ${key.id}) has been revoked and can no longer authenticate. ` +
        "Issue a new key from the admin UI's Settings > API Keys.",
    );
  }

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

  return {
    apiKeyId: key.id,
    apiKeyName: key.name,
    scopes: key.scopes as ApiKeyScope[],
    caller: { actor: { type: "system", id: key.id }, surface: "mcp" },
  };
}
