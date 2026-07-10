// Per-key rate limiting for MCP tool calls, reusing the shared Postgres
// sliding-window limiter (src/lib/rate-limit) -- same primitive and same
// ceiling src/lib/api/auth-middleware.ts uses for REST requests (that
// module's `DEFAULT_RATE_LIMIT` is private/unexported, so this mirrors its
// value directly, the same way src/lib/api/scopes.ts mirrors items.ts's
// private `touchesPriceFields`). One MCP tool call == one request for rate-
// limiting purposes, keyed by `mcp-key:<api key id>` so it never collides
// with that same key's REST-surface bucket (`api-key:<id>`).
import type { Database } from "@/db";
import { checkRateLimit } from "@/lib/rate-limit";

const MCP_RATE_LIMIT = { windowSeconds: 60, limit: 120 };

export class McpRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpRateLimitError";
  }
}

export async function assertMcpRateLimit(db: Database, apiKeyId: string): Promise<void> {
  const result = await checkRateLimit(db, {
    key: `mcp-key:${apiKeyId}`,
    windowSeconds: MCP_RATE_LIMIT.windowSeconds,
    limit: MCP_RATE_LIMIT.limit,
  });
  if (!result.allowed) {
    throw new McpRateLimitError(
      `Rate limit exceeded (${result.limit} tool calls / ${MCP_RATE_LIMIT.windowSeconds}s). Slow down and retry shortly.`,
    );
  }
}
