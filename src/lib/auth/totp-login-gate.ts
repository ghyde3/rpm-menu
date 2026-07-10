// Wires the TOTP 2FA already implemented in src/lib/auth/totp.ts +
// src/lib/service/settings/sessions.ts into Better Auth's actual sign-in
// flow. QA finding fix: 2FA was fully enrollable (real RFC 6238 TOTP,
// encrypted-at-rest secret, hashed backup codes) but never checked at
// login -- a compromised password alone still granted a full session.
//
// This is a small Better Auth plugin (id "rpm-totp-login-gate") registered
// in src/lib/auth/config.ts's `plugins` array. It does NOT use Better
// Auth's own built-in "two-factor" plugin, because that plugin owns its
// own schema (a dedicated `twoFactor` table + `user.twoFactorEnabled`
// field) and its own enrollment endpoints -- swapping to it would mean a
// schema migration and throwing away the already-built, already-audited
// enrollment/backup-code UI in Settings > Sessions & Security. Instead this
// re-implements just the login-time *gate* against the existing storage
// (accounts row with providerId "totp", scope "enabled"/"pending"), closely
// following the shape of Better Auth's own two-factor plugin
// (node_modules/better-auth/dist/plugins/two-factor/index.mjs +
// verify-two-factor.mjs) for the parts that must interoperate with core
// session/cookie handling:
//
//  1. `hooks.after` on `/sign-in/email`: if the user who just passed the
//     password check has 2FA enabled, delete the session Better Auth just
//     created (cookie + DB row) before it's ever observed by the caller,
//     stash a short-lived "pending 2FA" verification row + signed cookie,
//     and return `{ twoFactorRequired: true }` instead of a session.
//  2. `POST /rpm-2fa/verify`: reads that pending cookie, verifies a
//     submitted TOTP or backup code, and on success mints the real session
//     via the same `internalAdapter.createSession` + `setSessionCookie`
//     primitives Better Auth's own sign-in handler uses.
//
// Login is rate-limited per pending-challenge user (not just per IP) using
// the app's existing Postgres sliding-window limiter, since a 6-digit TOTP
// code is brute-forceable in ~1M requests without one.
import { createAuthEndpoint, createAuthMiddleware, APIError } from "better-auth/api";
import { setSessionCookie, deleteSessionCookie } from "better-auth/cookies";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptTotpSecret, verifyTotpToken, consumeBackupCode } from "./totp";

const PENDING_COOKIE_NAME = "rpm_2fa_pending";
const PENDING_MAX_AGE_SECONDS = 10 * 60; // 10 minutes to enter a code
const MAX_VERIFY_ATTEMPTS = 8;
const VERIFY_WINDOW_SECONDS = 5 * 60;

interface TotpAccountRow {
  id: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  scope: string | null;
}

async function getEnabledTotpAccount(userId: string): Promise<TotpAccountRow | null> {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "totp")));
  if (!row || row.scope !== "enabled" || !row.accessToken) return null;
  return row;
}

/** Verifies a submitted code against the user's enabled TOTP secret or
 * backup codes. Unlike `verifyMyTotp` in sessions.ts (which is used for the
 * disable/regenerate proof-of-possession check while already
 * authenticated), this persists a consumed backup code's reduced hash list
 * back to the DB so it's genuinely single-use -- required here since this
 * *is* the login-flow integration `consumeBackupCode`'s own doc comment
 * says callers must do. */
async function verifyLoginCode(row: TotpAccountRow, token: string): Promise<boolean> {
  const secret = await decryptTotpSecret(row.accessToken!);
  if (verifyTotpToken(secret, token)) return true;

  const hashes: string[] = row.refreshToken ? JSON.parse(row.refreshToken) : [];
  const remaining = consumeBackupCode(token, hashes);
  if (remaining === null) return false;

  await db.update(accounts).set({ refreshToken: JSON.stringify(remaining) }).where(eq(accounts.id, row.id));
  return true;
}

export const totpLoginGate = {
  id: "rpm-totp-login-gate",
  endpoints: {
    verifyLoginTotp: createAuthEndpoint(
      "/rpm-2fa/verify",
      {
        method: "POST",
        body: z.object({ code: z.string().trim().min(6).max(16) }),
      },
      async (ctx) => {
        const pendingCookie = ctx.context.createAuthCookie(PENDING_COOKIE_NAME, {
          maxAge: PENDING_MAX_AGE_SECONDS,
        });
        const pendingId = await ctx.getSignedCookie(pendingCookie.name, ctx.context.secret);
        if (!pendingId) {
          throw new APIError("UNAUTHORIZED", { message: "No pending sign-in to verify. Sign in again." });
        }

        const verification = await ctx.context.internalAdapter.findVerificationValue(pendingId);
        if (!verification || verification.expiresAt < new Date()) {
          throw new APIError("UNAUTHORIZED", { message: "This sign-in challenge has expired. Sign in again." });
        }
        const userId = verification.value;

        const rateLimit = await checkRateLimit(db, {
          key: `2fa-verify:${userId}`,
          windowSeconds: VERIFY_WINDOW_SECONDS,
          limit: MAX_VERIFY_ATTEMPTS,
        });
        if (!rateLimit.allowed) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Too many attempts. Try again in a few minutes." });
        }

        const row = await getEnabledTotpAccount(userId);
        if (!row) {
          // 2FA was disabled mid-challenge -- nothing left to verify against.
          throw new APIError("UNAUTHORIZED", { message: "This sign-in challenge is no longer valid. Sign in again." });
        }

        const valid = await verifyLoginCode(row, ctx.body.code);
        if (!valid) {
          throw new APIError("UNAUTHORIZED", { message: "Invalid code." });
        }

        // Single-use: atomically consume the pending challenge so this
        // endpoint can't be replayed to mint a second session from one
        // accepted code. Re-checks the consumed value matches (defends
        // against a concurrent request racing between the read above and
        // this consume, same as Better Auth's own two-factor plugin).
        const consumed = await ctx.context.internalAdapter.consumeVerificationValue(pendingId);
        if (!consumed || consumed.value !== userId) {
          throw new APIError("UNAUTHORIZED", { message: "This sign-in challenge has expired. Sign in again." });
        }

        const user = await ctx.context.internalAdapter.findUserById(userId);
        if (!user) {
          throw new APIError("UNAUTHORIZED", { message: "Account no longer exists." });
        }
        const session = await ctx.context.internalAdapter.createSession(userId, false);
        if (!session) {
          throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to create session." });
        }
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ token: session.token });
      },
    ),
  },
  hooks: {
    after: [
      {
        matcher: (context: { path?: string }) => context.path === "/sign-in/email",
        handler: createAuthMiddleware(async (ctx) => {
          const data = ctx.context.newSession;
          if (!data) return;

          const row = await getEnabledTotpAccount(data.user.id);
          if (!row) return; // no 2FA enrolled -- normal login stands.

          // Undo the credential sign-in's session: 2FA hasn't been
          // satisfied yet, so no caller should observe this session,
          // including this same response (deleteSessionCookie strips the
          // Set-Cookie the credential handler already queued).
          deleteSessionCookie(ctx, true);
          await ctx.context.internalAdapter.deleteSession(data.session.token);
          ctx.context.setNewSession(null);

          const identifier = `2fa-${randomBytes(20).toString("hex")}`;
          const expiresAt = new Date(Date.now() + PENDING_MAX_AGE_SECONDS * 1000);
          await ctx.context.internalAdapter.createVerificationValue({
            identifier,
            value: data.user.id,
            expiresAt,
          });

          const pendingCookie = ctx.context.createAuthCookie(PENDING_COOKIE_NAME, {
            maxAge: PENDING_MAX_AGE_SECONDS,
          });
          await ctx.setSignedCookie(pendingCookie.name, identifier, ctx.context.secret, pendingCookie.attributes);

          return ctx.json({ twoFactorRequired: true });
        }),
      },
    ],
  },
};
