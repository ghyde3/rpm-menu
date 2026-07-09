// Settings > Users tab (PRD §3.8): invite staff by email, assign role,
// deactivate/reactivate (kills sessions immediately), force password reset,
// and the at-least-one-active-owner invariant. Settings is "owner-only" per
// §3.8's section header, so every function here requires the owner role —
// there is no staff-level access to this module at all.
//
// No email-sending infra exists in this codebase (no mail library in
// package.json, which this unit may not add — see docs/architecture.md).
// "Invite by email" and "force password reset" therefore generate a random
// temporary password and return it once to the caller, mirroring the
// existing "shown once" convention used for API keys (§3.7) and the
// SEED_OWNER_PASSWORD generation in scripts/seed/index.ts. The owner relays
// it to the staff member out-of-band. This is a documented Phase 1 gap, not
// a silent shortcut.
//
// Zod validation lives inline in this file rather than a shared
// src/lib/validation/users.ts — this unit's owns_paths don't include the
// validation directory, and no other unit needs these schemas.
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { accounts, roleEnum, sessions, users } from "@/db/schema";
import {
  requireOwnerCaller,
  withAudit,
  registerRevertHandler,
  reviveDates,
  type DbClient,
  type ServiceCaller,
} from "./base";
import { NotFoundError, ConflictError } from "./base/errors";

/** The `users` row shape has no password column (that lives in `accounts`),
 * so it's always safe to return directly from this module. */
export type SafeUser = typeof users.$inferSelect;

// --- Validation -----------------------------------------------------------

export const inviteUserSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(200),
  role: z.enum(roleEnum).default("staff"),
});
export type InviteUserInput = z.input<typeof inviteUserSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(roleEnum),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const setUserActiveSchema = z.object({
  isActive: z.boolean(),
});
export type SetUserActiveInput = z.infer<typeof setUserActiveSchema>;

// --- Helpers ----------------------------------------------------------------

/** 32 chars of base64url — well over Better Auth's 8-char minimum, matches
 * scripts/seed/index.ts's `generatePassword`. */
function generateTemporaryPassword(): string {
  return randomBytes(24).toString("base64url");
}

async function getUserOrThrow(db: DbClient, userId: string): Promise<SafeUser> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundError("user", userId);
  return user;
}

/** Count of active owners, optionally excluding one user id (the one about
 * to be demoted/deactivated) — the at-least-one-active-owner check. */
async function countActiveOwners(db: DbClient, excludingUserId?: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "owner"), eq(users.isActive, true)));
  return rows.filter((row) => row.id !== excludingUserId).length;
}

/** Deactivation (and a forced password reset) must kill sessions
 * immediately (§3.8) — `getCurrentSession` also re-checks `isActive` on
 * every read, so this is belt-and-suspenders, but explicit revocation means
 * an already-open tab can't keep riding a live session cookie. */
async function killSessions(db: DbClient, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// --- Reads ------------------------------------------------------------------

export async function listUsers(db: DbClient, caller: ServiceCaller): Promise<SafeUser[]> {
  requireOwnerCaller(caller);
  return db.select().from(users);
}

export async function getUser(db: DbClient, caller: ServiceCaller, userId: string): Promise<SafeUser> {
  requireOwnerCaller(caller);
  return getUserOrThrow(db, userId);
}

// --- Writes -------------------------------------------------------------

export interface InviteUserResult {
  user: SafeUser;
  /** Shown once — see module doc. Never logged, never persisted in
   * plaintext, never included in the audit row. */
  temporaryPassword: string;
}

export async function inviteUser(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: InviteUserInput,
): Promise<InviteUserResult> {
  requireOwnerCaller(caller);
  const input = inviteUserSchema.parse(rawInput);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (existing) {
    throw new ConflictError(`A user with email "${input.email}" already exists.`);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "invite_user",
      entityType: "user",
      entityId: null,
      before: null,
    },
    async () => {
      const [created] = await db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          role: input.role,
          emailVerified: false,
          isActive: true,
        })
        .returning();
      await db.insert(accounts).values({
        userId: created.id,
        accountId: created.id,
        providerId: "credential",
        password: passwordHash,
      });
      return { result: created, after: created };
    },
  );

  return { user, temporaryPassword };
}

/**
 * Assigns a new role. Refuses (ConflictError) to demote the last active
 * owner — §3.8's "at least one active owner enforced (can't demote ... the
 * last owner)".
 */
export async function updateUserRole(
  db: DbClient,
  caller: ServiceCaller,
  userId: string,
  rawInput: UpdateUserRoleInput,
): Promise<SafeUser> {
  requireOwnerCaller(caller);
  const input = updateUserRoleSchema.parse(rawInput);
  const before = await getUserOrThrow(db, userId);

  if (before.role === "owner" && before.isActive && input.role !== "owner") {
    const remainingOwners = await countActiveOwners(db, userId);
    if (remainingOwners === 0) {
      throw new ConflictError("Cannot demote the last active owner — promote another owner first.");
    }
  }

  return withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_user_role",
      entityType: "user",
      entityId: userId,
      before,
    },
    async () => {
      const [after] = await db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return { result: after, after };
    },
  );
}

/**
 * Deactivate/reactivate. Refuses (ConflictError) to deactivate the last
 * active owner. Deactivation kills sessions immediately.
 */
export async function setUserActive(
  db: DbClient,
  caller: ServiceCaller,
  userId: string,
  rawInput: SetUserActiveInput,
): Promise<SafeUser> {
  requireOwnerCaller(caller);
  const input = setUserActiveSchema.parse(rawInput);
  const before = await getUserOrThrow(db, userId);

  if (!input.isActive && before.role === "owner" && before.isActive) {
    const remainingOwners = await countActiveOwners(db, userId);
    if (remainingOwners === 0) {
      throw new ConflictError("Cannot deactivate the last active owner.");
    }
  }

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: input.isActive ? "reactivate_user" : "deactivate_user",
      entityType: "user",
      entityId: userId,
      before,
    },
    async () => {
      const [after] = await db
        .update(users)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return { result: after, after };
    },
  );

  if (!input.isActive) {
    await killSessions(db, userId);
  }

  return updated;
}

export interface ForcePasswordResetResult {
  user: SafeUser;
  /** Shown once — see module doc. */
  temporaryPassword: string;
}

/** Rotates the user's credential password and kills their sessions so the
 * new password takes effect on next sign-in immediately. */
export async function forcePasswordReset(
  db: DbClient,
  caller: ServiceCaller,
  userId: string,
): Promise<ForcePasswordResetResult> {
  requireOwnerCaller(caller);
  const user = await getUserOrThrow(db, userId);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "force_password_reset",
      entityType: "user",
      entityId: userId,
      // Never snapshot password hashes into the audit log — this is a
      // deliberately minimal marker, not a full `users` row (see the
      // registerRevertHandler note below).
      before: { email: user.email },
    },
    async () => {
      const [existingAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));

      if (existingAccount) {
        await db
          .update(accounts)
          .set({ password: passwordHash, updatedAt: new Date() })
          .where(eq(accounts.id, existingAccount.id));
      } else {
        await db.insert(accounts).values({
          userId,
          accountId: userId,
          providerId: "credential",
          password: passwordHash,
        });
      }

      return { result: undefined, after: { email: user.email, reset: true } };
    },
  );

  await killSessions(db, userId);

  return { user, temporaryPassword };
}

// --- Revert registration ----------------------------------------------
//
// `before === null` => invite_user, so revert deletes the row (accounts row
// cascades via the FK). force_password_reset's `before` is a minimal
// `{ email }` marker, not a full row — there's no previous password hash to
// safely restore (the owner never had plaintext access to it anyway), so
// that action is not automatically revertable and is skipped here.
registerRevertHandler("user", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("user revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(users).where(eq(users.id, ctx.entityId));
    return;
  }
  const rawBefore = ctx.before as Record<string, unknown>;
  if (!("role" in rawBefore) || !("isActive" in rawBefore)) {
    return;
  }
  const beforeRow = reviveDates(rawBefore as SafeUser, ["createdAt", "updatedAt"]);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(users).values(beforeRow);
  } else {
    await db.update(users).set(beforeRow).where(eq(users.id, ctx.entityId));
  }
});
