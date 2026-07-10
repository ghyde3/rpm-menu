// Shared plumbing every tool in src/mcp/tools/** uses: the one `McpToolContext`
// passed to every handler, scope assertion (mirroring src/lib/api/scopes.ts's
// `hasScope`/`hasAllScopes`, same scope model the REST surface uses), and a
// thin "run a handler, wrap its return value as a CallToolResult" helper so
// every tool module stays focused on which service function it calls rather
// than re-deriving MCP response shape or rate-limit bookkeeping.
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Database } from "@/db";
import type { ServiceCaller } from "@/lib/service/base";
import { hasAllScopes, type ApiKeyScope } from "@/lib/api/scopes";
import { assertMcpRateLimit } from "./rate-limit";

export class McpScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpScopeError";
  }
}

/** Everything a tool handler needs: the DB client, a ready-to-use
 * `ServiceCaller` (actor/surface already resolved at startup -- see
 * src/mcp/auth.ts), the connected key's granted scopes, and its id (for
 * per-key rate limiting). One instance is built once at server startup and
 * threaded into every registered tool. */
export interface McpToolContext {
  db: Database;
  caller: ServiceCaller;
  scopes: ApiKeyScope[];
  apiKeyId: string;
}

/** Throws `McpScopeError` (surfaced to the AI client as a tool error result
 * by the SDK's own try/catch around tool callbacks) unless every scope in
 * `required` is present on the connected key. */
export function assertScope(scopes: readonly string[], required: ApiKeyScope | ApiKeyScope[]): void {
  const requiredList = Array.isArray(required) ? required : [required];
  if (!hasAllScopes(scopes, requiredList)) {
    const missing = requiredList.filter((s) => !scopes.includes(s));
    throw new McpScopeError(`API key is missing required scope(s): ${missing.join(", ")}`);
  }
}

/** Runs a tool handler after enforcing the per-key rate limit, then wraps
 * its return value as pretty-printed JSON text -- structured enough (§3.7:
 * "Tools return structured results including what changed") for any AI
 * client to parse and narrate, without introducing a second, bespoke result
 * schema per tool. Thrown errors (scope, not-found, role, validation, rate
 * limit) propagate to the caller; `McpServer.registerTool`'s own dispatcher
 * converts them into an `isError: true` result with the error's message --
 * this function doesn't need its own try/catch for that. */
export async function runTool<T>(ctx: McpToolContext, handler: () => Promise<T>): Promise<CallToolResult> {
  await assertMcpRateLimit(ctx.db, ctx.apiKeyId);
  const result = await handler();
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
