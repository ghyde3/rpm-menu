// Better Auth instance (§3.6): email+password, owner-invites-staff (no
// self-signup), Drizzle adapter reusing `users` as Better Auth's "user"
// model (src/db/schema/auth.ts) with `role`/`isActive` as additional fields.
// Route handler mount: src/app/api/auth/[...all]/route.ts.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { totpLoginGate } from "./totp-login-gate";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    // Our tables are named `users`/`sessions`/`accounts`/`verifications`
    // (plural, per PRD §5.1's `users` table) rather than Better Auth's
    // singular defaults.
    usePlural: true,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    // No self-signup (§3.6/§3.8): owner creates staff accounts from
    // Settings > Users. The sign-up endpoint stays wired for that flow but
    // is never exposed as a public "create your account" form.
    disableSignUp: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "staff",
        // Never settable from the public-facing sign-up payload — role is
        // assigned server-side by the Users settings tab (owner-only).
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  session: {
    // 7 days; deactivating a user (Settings > Users) kills sessions
    // immediately via role-guard.ts's isActive check, not via short expiry.
    expiresIn: 60 * 60 * 24 * 7,
  },
  advanced: {
    database: {
      // Every id column in src/db/schema is uuid — tell Better Auth to
      // generate UUIDs for rows it creates (users, sessions, accounts,
      // verifications) instead of its default nanoid-style string ids.
      generateId: "uuid",
    },
  },
  // Gates sign-in on TOTP 2FA for any user who has it enabled (QA fix: 2FA
  // was previously enrollable but never checked at login). See
  // ./totp-login-gate.ts's module doc for the full design.
  plugins: [totpLoginGate],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = Session["user"] & { role: "owner" | "staff"; isActive: boolean };
