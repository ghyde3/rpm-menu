// Builds the MCP server instance (tool registration only -- transport
// connection is src/mcp/index.ts's job, so this stays importable/testable
// without spinning up stdio).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "./tool-helpers";
import { registerTools } from "./tools/index";

export function createMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer({
    name: "rpm-menu",
    version: "0.1.0",
    title: "RPM Menu CMS",
  });
  registerTools(server, ctx);
  return server;
}
