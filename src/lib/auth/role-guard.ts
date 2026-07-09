// Role enforcement (§2, §3.6): "Role checks live in the service layer, not
// the UI — Phase 2 bots call the same functions and inherit the same
// enforcement." Every mutating service function should call one of these
// with the actor's role before writing, regardless of which surface
// (admin UI / REST API / MCP) invoked it.
import type { Role } from "@/db/schema";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export interface RoleCheckable {
  role: Role;
  isActive: boolean;
}

/** Throws AuthError(401) if `actor` is missing, or AuthError(403) if their
 * role isn't in `allowed`. Returns `actor` (narrowed, non-null) otherwise. */
export function requireRole<T extends RoleCheckable | null | undefined>(
  actor: T,
  allowed: Role[],
): NonNullable<T> {
  if (!actor) throw new AuthError("Authentication required", 401);
  if (!actor.isActive) throw new AuthError("Account deactivated", 401);
  if (!allowed.includes(actor.role)) {
    throw new AuthError(`Requires role: ${allowed.join(" or ")}`, 403);
  }
  return actor as NonNullable<T>;
}

export function requireOwner<T extends RoleCheckable | null | undefined>(actor: T): NonNullable<T> {
  return requireRole(actor, ["owner"]);
}

/** Owner or staff — i.e. any authenticated, active admin user. */
export function requireStaffOrOwner<T extends RoleCheckable | null | undefined>(actor: T): NonNullable<T> {
  return requireRole(actor, ["owner", "staff"]);
}
