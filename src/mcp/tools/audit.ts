// get_recent_changes (§3.7 "read audit log") -- straight passthrough to
// `listRecentChanges` (src/lib/service/revert.ts), the same function GET
// /api/v1/audit-log calls. `caller` is a pre-authorized `system` actor
// (src/lib/service/base/caller.ts's `isPreAuthorizedElsewhere`), so
// `listRecentChanges`'s own `requireStaffOrOwnerCaller` floor is a no-op
// here -- the `read` scope check below is what actually gates it for MCP.
import { listRecentChanges } from "@/lib/service/revert";
import { assertScope, type McpToolContext } from "../tool-helpers";
import type { GetRecentChangesArgs } from "./schemas";

export async function getRecentChanges(ctx: McpToolContext, args: GetRecentChangesArgs) {
  assertScope(ctx.scopes, "read");
  const entries = await listRecentChanges(ctx.db, ctx.caller, {
    actorId: args.actorId,
    entityType: args.entityType,
    limit: args.limit,
    offset: args.offset,
  });
  return { entries };
}
