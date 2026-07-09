// Bridges audit attribution (`Actor` — type + id, §4.2) with role
// enforcement (`src/lib/auth/role-guard.ts` — role + isActive, §2/§3.6) so
// every mutating service function can take one `caller` argument and get
// both for free.
//
// Convention: only `actor.type === "user"` callers (admin UI sessions) carry
// `role`/`isActive` here and get role-checked by this helper. `system`
// (REST API keys) and `display` actors are authorized by their own
// surface-specific gate *before* the service function is ever invoked — API
// key scope check in the REST route handler, MCP tool allowlist, display
// token verification — so there is no `Role` to check for them at this
// layer. Route/MCP/display handlers must perform their own gate first; this
// helper only protects the admin-UI path where the service layer is the
// only enforcement point.
import type { Role } from "@/db/schema";
import { requireOwner, requireStaffOrOwner } from "@/lib/auth/role-guard";
import type { Actor } from "./actor";
import type { Surface } from "@/db/schema";

export interface ServiceCaller {
  actor: Actor;
  surface: Surface;
  /** Required when `actor.type === "user"`; ignored otherwise. */
  role?: Role;
  /** Required when `actor.type === "user"`; ignored otherwise. */
  isActive?: boolean;
}

function isPreAuthorizedElsewhere(caller: ServiceCaller): boolean {
  return caller.actor.type !== "user";
}

/** Throws unless `caller` is staff or owner (or already authorized by a
 * non-admin-UI surface — see module doc). */
export function requireStaffOrOwnerCaller(caller: ServiceCaller): void {
  if (isPreAuthorizedElsewhere(caller)) return;
  requireStaffOrOwner({ role: caller.role as Role, isActive: caller.isActive ?? false });
}

/** Throws unless `caller` is owner (or already authorized by a non-admin-UI
 * surface — see module doc). */
export function requireOwnerCaller(caller: ServiceCaller): void {
  if (isPreAuthorizedElsewhere(caller)) return;
  requireOwner({ role: caller.role as Role, isActive: caller.isActive ?? false });
}
