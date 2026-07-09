// Cheap, edge-safe gate for /admin/**: redirects to /login if there's no
// session cookie at all. This is NOT the real auth check — it only avoids a
// pointless render for anonymous visitors. The real session+role
// verification (and the isActive/deactivation check) happens server-side in
// src/app/admin/layout.tsx via src/lib/auth/session.ts, because validating a
// session against the DB isn't something the edge middleware should do on
// every request.
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
