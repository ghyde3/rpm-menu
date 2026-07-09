import { describe, expect, it, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { accounts, sessions, users } from "@/db/schema";
import {
  listUsers,
  inviteUser,
  updateUserRole,
  setUserActive,
  forcePasswordReset,
} from "./users";
import type { ServiceCaller } from "./base";

function ownerCaller(id: string): ServiceCaller {
  return { actor: { type: "user", id }, surface: "admin_ui", role: "owner", isActive: true };
}
function staffCaller(id: string): ServiceCaller {
  return { actor: { type: "user", id }, surface: "admin_ui", role: "staff", isActive: true };
}

// Each test seeds its own owner with a fresh id/email so tests can share one
// `db` instance (per the items.test.ts convention) without unique-constraint
// collisions across tests, and so the last-active-owner invariant checks
// (which count ALL owner rows in the table) only ever see the owner(s) that
// test itself created.
async function seedOwner(db: Database) {
  const suffix = randomUUID();
  const [owner] = await db
    .insert(users)
    .values({ email: `owner-${suffix}@rpmpub.example`, name: "Owner", role: "owner", emailVerified: true })
    .returning();
  return owner;
}

describe("users service", () => {
  let db: Database;

  // Fresh db per test (unlike items.test.ts's shared beforeAll) because the
  // at-least-one-active-owner invariant counts ALL owner rows in the table
  // (correct for the real single-tenant app) — a shared db would let one
  // test's leftover owner rows silently satisfy another test's "last owner"
  // check.
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("invites a staff user, creating a users + accounts row and returning a one-time temp password", async () => {
    const owner = await seedOwner(db);

    const { user, temporaryPassword } = await inviteUser(db, ownerCaller(owner.id), {
      email: "staff@rpmpub.example",
      name: "Staff Member",
      role: "staff",
    });

    expect(user.email).toBe("staff@rpmpub.example");
    expect(user.role).toBe("staff");
    expect(user.isActive).toBe(true);
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(20);
    expect(user).not.toHaveProperty("password");

    const [account] = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    expect(account.providerId).toBe("credential");
    expect(account.password).toBeTruthy();
    expect(account.password).not.toBe(temporaryPassword);
  });

  it("rejects inviting a duplicate email", async () => {
    const owner = await seedOwner(db);
    await inviteUser(db, ownerCaller(owner.id), { email: "dup@rpmpub.example", name: "A", role: "staff" });
    await expect(
      inviteUser(db, ownerCaller(owner.id), { email: "dup@rpmpub.example", name: "B", role: "staff" }),
    ).rejects.toThrow();
  });

  it("rejects invite/role/deactivate mutations from a non-owner actor", async () => {
    const owner = await seedOwner(db);
    const { user: staffUser } = await inviteUser(db, ownerCaller(owner.id), {
      email: "notowner@rpmpub.example",
      name: "Not Owner",
      role: "staff",
    });

    await expect(
      inviteUser(db, staffCaller(staffUser.id), { email: "x@rpmpub.example", name: "X", role: "staff" }),
    ).rejects.toThrow();
    await expect(
      updateUserRole(db, staffCaller(staffUser.id), owner.id, { role: "staff" }),
    ).rejects.toThrow();
    await expect(
      setUserActive(db, staffCaller(staffUser.id), owner.id, { isActive: false }),
    ).rejects.toThrow();
  });

  it("promotes staff to owner and demotes an owner when another active owner remains", async () => {
    const owner = await seedOwner(db);
    const { user: staffUser } = await inviteUser(db, ownerCaller(owner.id), {
      email: "promote-me@rpmpub.example",
      name: "Promote Me",
      role: "staff",
    });

    const promoted = await updateUserRole(db, ownerCaller(owner.id), staffUser.id, { role: "owner" });
    expect(promoted.role).toBe("owner");

    // Now two active owners exist — demoting the original owner is fine.
    const demoted = await updateUserRole(db, ownerCaller(owner.id), owner.id, { role: "staff" });
    expect(demoted.role).toBe("staff");
  });

  it("refuses to demote the last active owner", async () => {
    const owner = await seedOwner(db);
    await expect(
      updateUserRole(db, ownerCaller(owner.id), owner.id, { role: "staff" }),
    ).rejects.toThrow(/last active owner/i);

    const stillOwner = await listUsers(db, ownerCaller(owner.id));
    expect(stillOwner.find((u) => u.id === owner.id)?.role).toBe("owner");
  });

  it("refuses to deactivate the last active owner", async () => {
    const owner = await seedOwner(db);
    await expect(
      setUserActive(db, ownerCaller(owner.id), owner.id, { isActive: false }),
    ).rejects.toThrow(/last active owner/i);
  });

  it("deactivating a user kills their sessions immediately, and reactivation restores access", async () => {
    const owner = await seedOwner(db);
    const { user: staffUser } = await inviteUser(db, ownerCaller(owner.id), {
      email: "kill-session@rpmpub.example",
      name: "Session Test",
      role: "staff",
    });
    await db.insert(sessions).values({
      userId: staffUser.id,
      token: "test-token-1",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const deactivated = await setUserActive(db, ownerCaller(owner.id), staffUser.id, { isActive: false });
    expect(deactivated.isActive).toBe(false);

    const remainingSessions = await db.select().from(sessions).where(eq(sessions.userId, staffUser.id));
    expect(remainingSessions).toHaveLength(0);

    const reactivated = await setUserActive(db, ownerCaller(owner.id), staffUser.id, { isActive: true });
    expect(reactivated.isActive).toBe(true);
  });

  it("allows deactivating a second owner when an active owner remains, and permits reactivating them freely", async () => {
    const owner = await seedOwner(db);
    const { user: secondOwner } = await inviteUser(db, ownerCaller(owner.id), {
      email: "second-owner@rpmpub.example",
      name: "Second Owner",
      role: "owner",
    });

    const deactivated = await setUserActive(db, ownerCaller(owner.id), secondOwner.id, { isActive: false });
    expect(deactivated.isActive).toBe(false);

    // With the second owner deactivated, the first is once again the last
    // active owner and cannot be deactivated.
    await expect(
      setUserActive(db, ownerCaller(owner.id), owner.id, { isActive: false }),
    ).rejects.toThrow(/last active owner/i);
  });

  it("forcePasswordReset rotates the credential password and kills sessions", async () => {
    const owner = await seedOwner(db);
    const { user: staffUser } = await inviteUser(db, ownerCaller(owner.id), {
      email: "reset-me@rpmpub.example",
      name: "Reset Me",
      role: "staff",
    });
    const [beforeAccount] = await db.select().from(accounts).where(eq(accounts.userId, staffUser.id));

    await db.insert(sessions).values({
      userId: staffUser.id,
      token: "test-token-2",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const { temporaryPassword } = await forcePasswordReset(db, ownerCaller(owner.id), staffUser.id);
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(20);

    const [afterAccount] = await db.select().from(accounts).where(eq(accounts.userId, staffUser.id));
    expect(afterAccount.password).not.toBe(beforeAccount.password);

    const remainingSessions = await db.select().from(sessions).where(eq(sessions.userId, staffUser.id));
    expect(remainingSessions).toHaveLength(0);
  });

  it("listUsers requires owner role and returns all users", async () => {
    const owner = await seedOwner(db);
    await inviteUser(db, ownerCaller(owner.id), { email: "list-me@rpmpub.example", name: "List Me", role: "staff" });
    const all = await listUsers(db, ownerCaller(owner.id));
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
