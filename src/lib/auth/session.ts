// Server-side session helpers for Server Components, Route Handlers, and
// Server Actions. Middleware (root middleware.ts) only does a cheap cookie
// presence check for redirects — this is where a session is actually
// verified against the DB, and where deactivation (Settings > Users,
// `isActive: false`) takes effect immediately.
import "server-only";
import { headers } from "next/headers";
import { auth, type AuthUser } from "./config";

export interface CurrentSession {
  user: AuthUser;
  session: { id: string; expiresAt: Date };
}

/** Returns the current session, or null if there isn't one, the user was
 * deactivated, or the cookie/token is invalid/expired. */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result?.user) return null;
  const user = result.user as AuthUser;
  // Deactivation (§3.8 Users tab) must kill sessions immediately — Better
  // Auth has no built-in notion of this, so it's enforced here on every read.
  if (user.isActive === false) return null;
  return { user, session: result.session };
}
