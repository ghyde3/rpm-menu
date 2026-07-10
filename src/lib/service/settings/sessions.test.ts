import { describe, expect, it, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { accounts, sessions, users } from "@/db/schema";
import {
  listMySessions,
  revokeSession,
  signOutEverywhere,
  changeMyPassword,
  getTotpStatus,
  startTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  verifyMyTotp,
} from "./sessions";
import { generateTotpToken, decryptTotpSecret } from "@/lib/auth/totp";
import type { ServiceCaller } from "../base";

function ownerCaller(id: string): ServiceCaller {
  return { actor: { type: "user", id }, surface: "admin_ui", role: "owner", isActive: true };
}
function staffCaller(id: string): ServiceCaller {
  return { actor: { type: "user", id }, surface: "admin_ui", role: "staff", isActive: true };
}

async function seedOwnerWithPassword(db: Database, password = "correct-horse-battery-staple") {
  const [owner] = await db
    .insert(users)
    .values({ email: `owner-${randomUUID()}@rpmpub.example`, name: "Owner", role: "owner", emailVerified: true })
    .returning();
  const passwordHash = await hashPassword(password);
  await db.insert(accounts).values({
    userId: owner.id,
    accountId: owner.id,
    providerId: "credential",
    password: passwordHash,
  });
  return owner;
}

async function seedSession(db: Database, userId: string) {
  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000 * 60),
    })
    .returning();
  return row;
}

describe("sessions service", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
    process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? "test-secret-for-session-tests";
  });

  describe("session listing/revocation", () => {
    it("lists only the caller's own sessions, stripping the raw token", async () => {
      const owner = await seedOwnerWithPassword(db);
      const other = await seedOwnerWithPassword(db);
      const mine = await seedSession(db, owner.id);
      await seedSession(db, other.id);

      const list = await listMySessions(db, ownerCaller(owner.id), mine.id);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(mine.id);
      expect(list[0]).not.toHaveProperty("token");
      expect(list[0].isCurrent).toBe(true);
    });

    it("revokes one of the caller's own sessions", async () => {
      const owner = await seedOwnerWithPassword(db);
      const session = await seedSession(db, owner.id);

      await revokeSession(db, ownerCaller(owner.id), session.id);

      const rows = await db.select().from(sessions).where(eq(sessions.id, session.id));
      expect(rows).toHaveLength(0);
    });

    it("refuses to revoke another user's session", async () => {
      const owner = await seedOwnerWithPassword(db);
      const other = await seedOwnerWithPassword(db);
      const theirSession = await seedSession(db, other.id);

      await expect(revokeSession(db, ownerCaller(owner.id), theirSession.id)).rejects.toThrow();

      const rows = await db.select().from(sessions).where(eq(sessions.id, theirSession.id));
      expect(rows).toHaveLength(1);
    });

    it("signs out everywhere, deleting every session for the caller only", async () => {
      const owner = await seedOwnerWithPassword(db);
      const other = await seedOwnerWithPassword(db);
      await seedSession(db, owner.id);
      await seedSession(db, owner.id);
      const theirs = await seedSession(db, other.id);

      const { revokedCount } = await signOutEverywhere(db, ownerCaller(owner.id));
      expect(revokedCount).toBe(2);

      const mineLeft = await db.select().from(sessions).where(eq(sessions.userId, owner.id));
      expect(mineLeft).toHaveLength(0);
      const theirsLeft = await db.select().from(sessions).where(eq(sessions.id, theirs.id));
      expect(theirsLeft).toHaveLength(1);
    });

    it("rejects non-owner callers", async () => {
      const owner = await seedOwnerWithPassword(db);
      await expect(listMySessions(db, staffCaller(owner.id))).rejects.toThrow();
    });
  });

  describe("password change", () => {
    it("changes the password given the correct current password, killing all sessions", async () => {
      const owner = await seedOwnerWithPassword(db, "old-password-123");
      await seedSession(db, owner.id);

      await changeMyPassword(db, ownerCaller(owner.id), {
        currentPassword: "old-password-123",
        newPassword: "new-password-456",
      });

      const [account] = await db.select().from(accounts).where(eq(accounts.userId, owner.id));
      expect(account.password).toBeTruthy();

      const remainingSessions = await db.select().from(sessions).where(eq(sessions.userId, owner.id));
      expect(remainingSessions).toHaveLength(0);
    });

    it("rejects an incorrect current password without mutating anything", async () => {
      const owner = await seedOwnerWithPassword(db, "old-password-123");
      const [before] = await db.select().from(accounts).where(eq(accounts.userId, owner.id));

      await expect(
        changeMyPassword(db, ownerCaller(owner.id), {
          currentPassword: "wrong-password",
          newPassword: "new-password-456",
        }),
      ).rejects.toThrow();

      const [after] = await db.select().from(accounts).where(eq(accounts.userId, owner.id));
      expect(after.password).toBe(before.password);
    });

    it("rejects a new password shorter than 8 characters", async () => {
      const owner = await seedOwnerWithPassword(db, "old-password-123");
      await expect(
        changeMyPassword(db, ownerCaller(owner.id), { currentPassword: "old-password-123", newPassword: "short" }),
      ).rejects.toThrow();
    });
  });

  describe("TOTP enrollment", () => {
    it("starts disabled", async () => {
      const owner = await seedOwnerWithPassword(db);
      const status = await getTotpStatus(db, ownerCaller(owner.id));
      expect(status).toEqual({ enabled: false, pending: false });
    });

    it("full enroll -> confirm -> verify -> disable lifecycle", async () => {
      const owner = await seedOwnerWithPassword(db);

      const enrollment = await startTotpEnrollment(db, ownerCaller(owner.id));
      expect(enrollment.secret).toMatch(/^[A-Z2-7]+$/);
      expect(enrollment.otpauthUri.startsWith("otpauth://totp/")).toBe(true);
      expect(enrollment.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);

      let status = await getTotpStatus(db, ownerCaller(owner.id));
      expect(status).toEqual({ enabled: false, pending: true });

      const token = generateTotpToken(enrollment.secret);
      const { backupCodes } = await confirmTotpEnrollment(db, ownerCaller(owner.id), token);
      expect(backupCodes).toHaveLength(10);

      status = await getTotpStatus(db, ownerCaller(owner.id));
      expect(status).toEqual({ enabled: true, pending: false });

      const nextToken = generateTotpToken(enrollment.secret);
      expect(await verifyMyTotp(db, ownerCaller(owner.id), nextToken)).toBe(true);
      expect(await verifyMyTotp(db, ownerCaller(owner.id), "000000")).toBe(false);

      // A backup code also authenticates.
      expect(await verifyMyTotp(db, ownerCaller(owner.id), backupCodes[0])).toBe(true);

      // Disabling requires a valid code.
      const disableToken = generateTotpToken(enrollment.secret);
      await disableTotp(db, ownerCaller(owner.id), disableToken);

      status = await getTotpStatus(db, ownerCaller(owner.id));
      expect(status).toEqual({ enabled: false, pending: false });
    });

    it("rejects confirming enrollment with a wrong code", async () => {
      const owner = await seedOwnerWithPassword(db);
      await startTotpEnrollment(db, ownerCaller(owner.id));
      await expect(confirmTotpEnrollment(db, ownerCaller(owner.id), "000000")).rejects.toThrow();
    });

    it("rejects confirming with no pending enrollment", async () => {
      const owner = await seedOwnerWithPassword(db);
      await expect(confirmTotpEnrollment(db, ownerCaller(owner.id), "123456")).rejects.toThrow();
    });

    it("rejects re-enrolling while already enabled", async () => {
      const owner = await seedOwnerWithPassword(db);
      const enrollment = await startTotpEnrollment(db, ownerCaller(owner.id));
      await confirmTotpEnrollment(db, ownerCaller(owner.id), generateTotpToken(enrollment.secret));
      await expect(startTotpEnrollment(db, ownerCaller(owner.id))).rejects.toThrow();
    });

    it("rejects disabling with an invalid code", async () => {
      const owner = await seedOwnerWithPassword(db);
      const enrollment = await startTotpEnrollment(db, ownerCaller(owner.id));
      await confirmTotpEnrollment(db, ownerCaller(owner.id), generateTotpToken(enrollment.secret));
      await expect(disableTotp(db, ownerCaller(owner.id), "000000")).rejects.toThrow();
    });

    it("stores the secret encrypted, not in plaintext", async () => {
      const owner = await seedOwnerWithPassword(db);
      const enrollment = await startTotpEnrollment(db, ownerCaller(owner.id));

      const accountRows = await db.select().from(accounts).where(eq(accounts.userId, owner.id));
      const totpRow = accountRows.find((r) => r.providerId === "totp")!;
      expect(totpRow.accessToken).not.toBe(enrollment.secret);
      expect(await decryptTotpSecret(totpRow.accessToken as string)).toBe(enrollment.secret);
    });
  });
});
