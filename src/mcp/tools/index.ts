// Registers all 9 spec'd tools (§3.7) onto an `McpServer` instance, wiring
// each one's raw Zod shape (schemas.ts) + handler (items.ts/pending-
// changes.ts/screens.ts/audit.ts) through the shared `runTool` wrapper
// (rate limit + JSON-text result shape -- src/mcp/tool-helpers.ts). Kept
// separate from src/mcp/server.ts so the tool list itself -- name,
// description, schema, handler -- reads as one table.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runTool, type McpToolContext } from "../tool-helpers";
import {
  searchItemsShape,
  setAvailabilityShape,
  updateItemShape,
  list86dShape,
  previewPriceAdjustmentShape,
  applyPendingChangeShape,
  getScreenShape,
  updateScreenShape,
  getRecentChangesShape,
} from "./schemas";
import { searchItems, setAvailability, updateItem, list86d } from "./items";
import { previewPriceAdjustment, applyPendingChange } from "./pending-changes";
import { getScreen, updateScreen } from "./screens";
import { getRecentChanges } from "./audit";

export function registerTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    "search_items",
    {
      title: "Search items",
      description:
        "Search/list menu items by name/description text, category, tag, availability, or pricing type. Read-only.",
      inputSchema: searchItemsShape,
    },
    (args) => runTool(ctx, () => searchItems(ctx, args)),
  );

  server.registerTool(
    "set_availability",
    {
      title: "86 / un-86 an item",
      description:
        "Toggle a single item's availability (the '86 it' action) on or off. One-step -- no preview needed for a single-item availability change.",
      inputSchema: setAvailabilityShape,
    },
    (args) => runTool(ctx, () => setAvailability(ctx, args)),
  );

  server.registerTool(
    "update_item",
    {
      title: "Update an item",
      description:
        "Update one item's fields (name, description, category, sort order, image, aliases, typed attributes, and -- with the write:prices scope -- price/pricing type). One-step.",
      inputSchema: updateItemShape,
    },
    (args) => runTool(ctx, () => updateItem(ctx, args)),
  );

  server.registerTool(
    "preview_price_adjustment",
    {
      title: "Preview a bulk price adjustment",
      description:
        "Dry-run a flat-cents or percent price adjustment across a set of items. Writes nothing -- returns a diff and a pendingChangeId that expires in 15 minutes. Call apply_pending_change with that id to actually commit it.",
      inputSchema: previewPriceAdjustmentShape,
    },
    (args) => runTool(ctx, () => previewPriceAdjustment(ctx, args)),
  );

  server.registerTool(
    "apply_pending_change",
    {
      title: "Apply a previewed change",
      description:
        "Commits a change previously created by preview_price_adjustment, identified by the pendingChangeId it returned. Fails if that id is unknown, already applied/cancelled, or expired (15-minute TTL).",
      inputSchema: applyPendingChangeShape,
    },
    (args) => runTool(ctx, () => applyPendingChange(ctx, args)),
  );

  server.registerTool(
    "list_86d",
    {
      title: "List 86'd (unavailable) items",
      description: "Lists every item currently marked unavailable, optionally filtered by name/description text or category. Read-only.",
      inputSchema: list86dShape,
    },
    (args) => runTool(ctx, () => list86d(ctx, args)),
  );

  server.registerTool(
    "get_screen",
    {
      title: "Get a screen",
      description: "Reads one display screen's full configuration (template, source mode/config, display options). Read-only.",
      inputSchema: getScreenShape,
    },
    (args) => runTool(ctx, () => getScreen(ctx, args)),
  );

  server.registerTool(
    "update_screen",
    {
      title: "Update a screen",
      description:
        "Updates one screen's name, template, source mode/config, display options, or background image. Owner-only capability -- requires the write:screens scope.",
      inputSchema: updateScreenShape,
    },
    (args) => runTool(ctx, () => updateScreen(ctx, args)),
  );

  server.registerTool(
    "get_recent_changes",
    {
      title: "Get recent changes",
      description:
        "Reads the audit log / \"recent changes\" feed, optionally filtered by actor or entity type. Read-only.",
      inputSchema: getRecentChangesShape,
    },
    (args) => runTool(ctx, () => getRecentChanges(ctx, args)),
  );
}
