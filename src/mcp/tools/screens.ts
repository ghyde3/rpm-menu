// get_screen, update_screen (§3.7). Straight passthrough to
// src/lib/service/screens.ts -- the same functions GET/PATCH
// /api/v1/screens/:id call.
import { getScreen as getScreenService, updateScreen as updateScreenService } from "@/lib/service/screens";
import { assertScope, type McpToolContext } from "../tool-helpers";
import type { GetScreenArgs, UpdateScreenArgs } from "./schemas";

export async function getScreen(ctx: McpToolContext, args: GetScreenArgs) {
  assertScope(ctx.scopes, "read");
  const screen = await getScreenService(ctx.db, args.screenId);
  return { screen };
}

export async function updateScreen(ctx: McpToolContext, args: UpdateScreenArgs) {
  assertScope(ctx.scopes, "write:screens");
  const { screenId, ...rest } = args;
  const screen = await updateScreenService(ctx.db, ctx.caller, screenId, rest);
  return { screen };
}
