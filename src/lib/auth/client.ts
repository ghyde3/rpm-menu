"use client";

// Browser-side Better Auth client (sign-in/sign-out from the login page and
// admin shell). Server components/route handlers use src/lib/auth/session.ts
// instead — never this file.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
