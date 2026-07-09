import type { ActorType } from "@/db/schema";

/** Who performed a mutation, for audit attribution (§3.5). REST API keys and
 * MCP tool calls are attributed with `type: "system"` and `id` set to the
 * api_keys row id (see docs/architecture.md's "actor attribution" note) —
 * `actor_type` stays a fixed 3-value enum per §4.2, `surface` distinguishes
 * "admin_ui" from "api"/"mcp". */
export interface Actor {
  type: ActorType;
  id: string | null;
}
