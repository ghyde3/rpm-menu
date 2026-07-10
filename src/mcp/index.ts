#!/usr/bin/env node
// MCP server entrypoint (`npm run mcp`, docs/mcp-server.md). Launch order:
//   1. Build the DB client (src/mcp/db.ts) -- refuses to start against a
//      PGlite data dir another live process already holds.
//   2. Validate MCP_API_KEY against `api_keys` (src/mcp/auth.ts) -- refuses
//      to start on a missing/unknown/revoked key.
//   3. Register tools (src/mcp/server.ts) and connect the stdio transport.
//
// Every diagnostic goes to stderr (`console.error`) -- stdout is the JSON-RPC
// message channel for the stdio transport (§3.7's MCP server), so anything
// written to stdout that isn't a protocol message corrupts the connection.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpDb } from "./db";
import { authenticateMcpServer, type McpIdentity } from "./auth";
import { createMcpServer } from "./server";

function fail(message: string): never {
  console.error(`[rpm-menu mcp] ${message}`);
  process.exit(1);
}

async function main() {
  let dbHandle: ReturnType<typeof createMcpDb>;
  try {
    dbHandle = createMcpDb();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  const { db, pgliteLock } = dbHandle;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    pgliteLock?.release();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  let identity: McpIdentity;
  try {
    identity = await authenticateMcpServer(db, process.env.MCP_API_KEY);
  } catch (err) {
    cleanup();
    fail(err instanceof Error ? err.message : String(err));
  }

  const server = createMcpServer({
    db,
    caller: identity.caller,
    scopes: identity.scopes,
    apiKeyId: identity.apiKeyId,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[rpm-menu mcp] connected as API key "${identity.apiKeyName}" (scopes: ${identity.scopes.join(", ") || "none"})`,
  );
}

main().catch((err) => {
  console.error("[rpm-menu mcp] fatal error:", err);
  process.exit(1);
});
