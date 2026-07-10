// Settings > Sessions & Security tab (§3.8): the signed-in owner's own
// active sessions (list + revoke + "sign out everywhere"), password change,
// and optional TOTP 2FA. Owner-only per §3.8's section header -- this is
// "your own account security", not an admin view of every user's sessions
// (that would overlap the Users tab, owned by a different unit).
//
// TOTP storage (documented gap, not a silent shortcut): the schema has no
// dedicated two-factor table and this unit's owns_paths don't include
// src/db/schema/** ("report gaps, don't patch"). This reuses the existing
// `accounts` table -- already Better Auth's generic "one row per (user,
// provider) credential" shape (`providerId: "credential"` holds the
// password hash) -- with a second `providerId: "totp"` row per user:
//   - `accessToken`  -- the TOTP secret, `better-auth/crypto` `symmetricEncrypt`-
//                       encrypted at rest (see src/lib/auth/totp.ts).
//   - `refreshToken` -- JSON array of SHA-256 backup-code hashes.
//   - `scope`        -- `"pending"` (enrolled, not yet confirmed) or
//                       `"enabled"`.
// Encryption (not just hashing) is required here because, unlike a
// password, the secret must be recovered in full to verify a submitted
// code -- see totp.ts's module doc for why `symmetricEncrypt`/`decrypt`
// keyed off `BETTER_AUTH_SECRET` was chosen over adding a second secret.
//
// Known scope boundary: this module manages enrollment/verification of
// TOTP, but does NOT gate Better Auth's sign-in flow on it -- wiring a
// second-factor challenge into the login step touches
// src/lib/auth/config.ts and src/app/login/**, neither of which is in this
// unit's owns_paths. Flagged as follow-up integration work, not silently
// skipped.
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { accounts, sessions, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/role-guard";
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  buildOtpAuthUri,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
  consumeBackupCode,
} from "@/lib/auth/totp";
import { generateMenuQrPreviewDataUrl } from "@/lib/qr/generate";
import { requireOwnerCaller, withAudit, type DbClient, type ServiceCaller } from "../base";
import { NotFoundError, ConflictError } from "../base/errors";

const TOTP_PROVIDER_ID = "totp";
const CREDENTIAL_PROVIDER_ID = "credential";
const TOTP_ISSUER = "RPM Menu CMS";

function requireUserActorId(caller: ServiceCaller): string {
  requireOwnerCaller(caller);
  if (!caller.actor.id) throw new AuthError("Authentication required", 401);
  return caller.actor.id;
}

// --- Sessions ---------------------------------------------------------------

export type SafeSession = Omit<typeof sessions.$inferSelect, "token"> & { isCurrent: boolean };

/** Lists the caller's own sessions (never another user's -- see module
 * doc), newest-first, with the live session token stripped (it's a bearer
 * credential, never safe to round-trip to a client). */
export async function listMySessions(
  db: DbClient,
  caller: ServiceCaller,
  currentSessionId?: string,
): Promise<SafeSession[]> {
  const userId = requireUserActorId(caller);
  const rows = await db.select().from(sessions).where(eq(sessions.userId, userId));
  return rows
    .map((row) => {
      const safe: Partial<typeof row> = { ...row };
      delete safe.token;
      return { ...(safe as Omit<typeof row, "token">), isCurrent: row.id === currentSessionId };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Revokes one of the caller's own sessions. Refuses (NotFoundError,
 * indistinguishable from "doesn't exist") to touch a session belonging to
 * someone else. */
export async function revokeSession(db: DbClient, caller: ServiceCaller, sessionId: string): Promise<void> {
  const userId = requireUserActorId(caller);
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!row || row.userId !== userId) {
    throw new NotFoundError("session", sessionId);
  }

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "revoke_session",
      entityType: "user",
      entityId: userId,
      // Minimal, non-full-row marker -- mirrors users.ts's
      // force_password_reset convention. The shared "user" revert handler
      // (users.ts) requires `role`/`isActive` keys to attempt a restore and
      // silently no-ops otherwise, so this is intentionally not
      // auto-revertable (there is nothing meaningful to "undo" about a
      // killed session).
      before: { revokedSessionId: sessionId },
    },
    async () => {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
      return { result: undefined, after: { revokedSessionId: sessionId } };
    },
  );
}

/** "Sign out everywhere" (§3.8) -- kills every session for the caller,
 * including the one making this request; the client is expected to
 * redirect to /login afterward. */
export async function signOutEverywhere(db: DbClient, caller: ServiceCaller): Promise<{ revokedCount: number }> {
  const userId = requireUserActorId(caller);
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "sign_out_everywhere",
      entityType: "user",
      entityId: userId,
      before: { revokedSessionCount: rows.length },
    },
    async () => {
      await db.delete(sessions).where(eq(sessions.userId, userId));
      return { result: undefined, after: { revokedSessionCount: rows.length } };
    },
  );

  return { revokedCount: rows.length };
}

// --- Password change ---------------------------------------------------

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

/** Owner password change (§3.8). Verifies the current password, rotates
 * the credential hash, and kills every session (including this one) so the
 * new password takes effect everywhere immediately -- same posture as
 * users.ts's `forcePasswordReset`. */
export async function changeMyPassword(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: ChangePasswordInput,
): Promise<void> {
  const userId = requireUserActorId(caller);
  const input = changePasswordSchema.parse(rawInput);

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, CREDENTIAL_PROVIDER_ID)));
  if (!account || !account.password) {
    throw new ConflictError("No password credential on file for this account.");
  }

  const valid = await verifyPassword({ hash: account.password, password: input.currentPassword });
  if (!valid) {
    throw new AuthError("Current password is incorrect.", 400);
  }

  const newHash = await hashPassword(input.newPassword);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "change_password",
      entityType: "user",
      entityId: userId,
      before: { passwordChanged: false },
    },
    async () => {
      await db
        .update(accounts)
        .set({ password: newHash, updatedAt: new Date() })
        .where(eq(accounts.id, account.id));
      return { result: undefined, after: { changed: true } };
    },
  );

  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// --- TOTP 2FA ---------------------------------------------------------------

export interface TotpStatus {
  enabled: boolean;
  pending: boolean;
}

async function getTotpAccountRow(db: DbClient, userId: string) {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, TOTP_PROVIDER_ID)));
  return row;
}

export async function getTotpStatus(db: DbClient, caller: ServiceCaller): Promise<TotpStatus> {
  const userId = requireUserActorId(caller);
  const row = await getTotpAccountRow(db, userId);
  if (!row) return { enabled: false, pending: false };
  return { enabled: row.scope === "enabled", pending: row.scope === "pending" };
}

export interface StartTotpEnrollmentResult {
  /** Base32 secret for manual entry in an authenticator app. */
  secret: string;
  otpauthUri: string;
  /** Inline `data:image/png;base64,...` QR the user can scan instead of
   * typing the secret -- generated with this unit's own QR module
   * (src/lib/qr/**), same underlying `qrcode` package as the menu QR. */
  qrDataUrl: string;
}

/** Starts (or restarts) enrollment: generates a fresh secret, stores it
 * encrypted with `scope: "pending"`. Not yet "enabled" -- a confirmed code
 * via `confirmTotpEnrollment` is required before it protects anything.
 * Refuses to start if 2FA is already enabled (disable first to re-enroll,
 * so a mid-flight enrollment attempt can't silently replace a working
 * secret out from under the account). */
export async function startTotpEnrollment(
  db: DbClient,
  caller: ServiceCaller,
): Promise<StartTotpEnrollmentResult> {
  const userId = requireUserActorId(caller);
  const existing = await getTotpAccountRow(db, userId);
  if (existing?.scope === "enabled") {
    throw new ConflictError("2FA is already enabled -- disable it before re-enrolling.");
  }

  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundError("user", userId);

  const secret = generateTotpSecret();
  const encrypted = await encryptTotpSecret(secret);
  const otpauthUri = buildOtpAuthUri({ secretBase32: secret, accountName: user.email, issuer: TOTP_ISSUER });
  const qrDataUrl = await generateMenuQrPreviewDataUrl(otpauthUri);

  if (existing) {
    await db
      .update(accounts)
      .set({ accessToken: encrypted, refreshToken: null, scope: "pending", updatedAt: new Date() })
      .where(eq(accounts.id, existing.id));
  } else {
    await db.insert(accounts).values({
      userId,
      accountId: userId,
      providerId: TOTP_PROVIDER_ID,
      accessToken: encrypted,
      scope: "pending",
    });
  }

  // Enrollment start isn't independently security-sensitive (no factor is
  // active yet) -- the audited, user-visible moment is `confirmTotpEnrollment`
  // actually turning 2FA on, so no audit row is written here.
  return { secret, otpauthUri, qrDataUrl };
}

export interface ConfirmTotpEnrollmentResult {
  /** Shown once -- relay to the user now; never retrievable again after
   * this call (only hashes are persisted). */
  backupCodes: string[];
}

/** Confirms enrollment with a live 6-digit code, flips the row to
 * `scope: "enabled"`, and issues one-time backup codes. */
export async function confirmTotpEnrollment(
  db: DbClient,
  caller: ServiceCaller,
  token: string,
): Promise<ConfirmTotpEnrollmentResult> {
  const userId = requireUserActorId(caller);
  const row = await getTotpAccountRow(db, userId);
  if (!row || row.scope !== "pending" || !row.accessToken) {
    throw new ConflictError("No pending 2FA enrollment to confirm -- start enrollment first.");
  }

  const secret = await decryptTotpSecret(row.accessToken);
  if (!verifyTotpToken(secret, token)) {
    throw new AuthError("Invalid or expired code.", 400);
  }

  const backupCodes = generateBackupCodes();
  const hashes = backupCodes.map(hashBackupCode);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "enable_totp",
      entityType: "user",
      entityId: userId,
      before: { totpEnabled: false },
    },
    async () => {
      await db
        .update(accounts)
        .set({ scope: "enabled", refreshToken: JSON.stringify(hashes), updatedAt: new Date() })
        .where(eq(accounts.id, row.id));
      return { result: undefined, after: { totpEnabled: true } };
    },
  );

  return { backupCodes };
}

/** Disables 2FA. Requires a live TOTP code OR one of the remaining backup
 * codes as proof of possession -- a lost/stolen session alone shouldn't be
 * able to turn off the owner's second factor. */
export async function disableTotp(db: DbClient, caller: ServiceCaller, token: string): Promise<void> {
  const userId = requireUserActorId(caller);
  const row = await getTotpAccountRow(db, userId);
  if (!row || row.scope !== "enabled" || !row.accessToken) {
    throw new ConflictError("2FA is not enabled.");
  }

  const secret = await decryptTotpSecret(row.accessToken);
  const totpValid = verifyTotpToken(secret, token);
  const backupHashes: string[] = row.refreshToken ? JSON.parse(row.refreshToken) : [];
  const backupValid = !totpValid && consumeBackupCode(token, backupHashes) !== null;

  if (!totpValid && !backupValid) {
    throw new AuthError("Invalid code.", 400);
  }

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "disable_totp",
      entityType: "user",
      entityId: userId,
      before: { totpEnabled: true },
    },
    async () => {
      await db.delete(accounts).where(eq(accounts.id, row.id));
      return { result: undefined, after: { totpEnabled: false } };
    },
  );
}

/** Verifies a submitted code (TOTP or backup) against the caller's
 * enabled 2FA -- exposed for any future login-flow integration to call
 * (see module doc's "known scope boundary"); not used by this tab's UI
 * directly beyond disable/regenerate's proof-of-possession check. */
export async function verifyMyTotp(db: DbClient, caller: ServiceCaller, token: string): Promise<boolean> {
  const userId = requireUserActorId(caller);
  const row = await getTotpAccountRow(db, userId);
  if (!row || row.scope !== "enabled" || !row.accessToken) return false;
  const secret = await decryptTotpSecret(row.accessToken);
  if (verifyTotpToken(secret, token)) return true;
  const backupHashes: string[] = row.refreshToken ? JSON.parse(row.refreshToken) : [];
  return consumeBackupCode(token, backupHashes) !== null;
}
