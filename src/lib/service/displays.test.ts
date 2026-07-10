import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { displays, pairingCodes, screens } from "@/db/schema";
import {
  createPairingCode,
  pollPairingCode,
  claimPairingCode,
  listDisplays,
  getDisplay,
  updateDisplay,
  revokeDisplay,
  deleteDisplay,
  verifyDisplayAuth,
  recordHeartbeat,
  getCurrentScreenForDisplay,
  computeHeartbeatStatus,
} from "./displays";
import { createSchedule } from "./schedules";
import { revertAuditEntry } from "./base/audit";
import type { ServiceCaller } from "./base";
import { AuthError } from "@/lib/auth/role-guard";
import { NotFoundError, ConflictError } from "./base/errors";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000aa" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

const staff: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000bb" },
  surface: "admin_ui",
  role: "staff",
  isActive: true,
};

async function seedScreen(db: Database, name = "Draft List") {
  const [screen] = await db.insert(screens).values({ name, template: "list", sourceMode: "query" }).returning();
  return screen;
}

describe("computeHeartbeatStatus", () => {
  const now = new Date("2026-07-09T12:00:00Z");

  it("is offline when never seen", () => {
    expect(computeHeartbeatStatus(null, now)).toBe("offline");
  });

  it("is online under 2 minutes", () => {
    expect(computeHeartbeatStatus(new Date(now.getTime() - 60_000), now)).toBe("online");
  });

  it("is warning between 2 and 10 minutes", () => {
    expect(computeHeartbeatStatus(new Date(now.getTime() - 5 * 60_000), now)).toBe("warning");
  });

  it("is offline past 10 minutes", () => {
    expect(computeHeartbeatStatus(new Date(now.getTime() - 11 * 60_000), now)).toBe("offline");
  });
});

describe("displays service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("full pairing flow: create code -> claim -> TV poll mints a token exactly once", async () => {
    const screen = await seedScreen(db, "Pairing-flow-screen");
    const { code } = await createPairingCode(db);

    // TV polls before claim -> pending.
    expect(await pollPairingCode(db, code)).toEqual({ status: "pending" });

    // Owner claims it from the admin UI.
    const claimed = await claimPairingCode(db, owner, { code, name: "Bar TV", screenId: screen.id });
    expect(claimed.name).toBe("Bar TV");
    expect(claimed.tokenHash).toBeNull();

    // First TV poll after claim mints the token.
    const firstPoll = await pollPairingCode(db, code);
    expect(firstPoll.status).toBe("paired");
    if (firstPoll.status !== "paired") throw new Error("expected paired");
    expect(firstPoll.token).toBeTruthy();
    expect(firstPoll.displayId).toBe(claimed.id);

    // The token verifies against the stored hash.
    const verified = await verifyDisplayAuth(db, claimed.id, firstPoll.token);
    expect(verified?.id).toBe(claimed.id);
    expect(await verifyDisplayAuth(db, claimed.id, "wrong-token")).toBeNull();

    // The pairing code is single-use — it's gone now.
    expect(await pollPairingCode(db, code)).toEqual({ status: "not_found" });
  });

  it("claiming twice, an unknown code, or an expired code all fail", async () => {
    const { code } = await createPairingCode(db);
    await claimPairingCode(db, owner, { code, name: "TV A" });
    await expect(claimPairingCode(db, owner, { code, name: "TV B" })).rejects.toThrow(ConflictError);

    await expect(claimPairingCode(db, owner, { code: "ZZZZZZ" })).rejects.toThrow(NotFoundError);

    const { code: expiring } = await createPairingCode(db);
    await db.update(pairingCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(pairingCodes.code, expiring));
    await expect(claimPairingCode(db, owner, { code: expiring, name: "TV C" })).rejects.toThrow(ConflictError);
    expect(await pollPairingCode(db, expiring)).toEqual({ status: "expired" });
  });

  it("claiming requires the owner role", async () => {
    const { code } = await createPairingCode(db);
    await expect(claimPairingCode(db, staff, { code, name: "Nope" })).rejects.toThrow(AuthError);
  });

  it("claiming with an unknown screenId fails", async () => {
    const { code } = await createPairingCode(db);
    await expect(
      claimPairingCode(db, owner, { code, name: "TV", screenId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("lists displays with heartbeat status and screen name (owner only)", async () => {
    const screen = await seedScreen(db, "List-flow-screen");
    const { code } = await createPairingCode(db);
    const display = await claimPairingCode(db, owner, { code, name: "Listed TV", screenId: screen.id });

    await expect(listDisplays(db, staff)).rejects.toThrow(AuthError);

    const list = await listDisplays(db, owner);
    const entry = list.find((d) => d.id === display.id);
    expect(entry).toBeTruthy();
    expect(entry?.heartbeat).toBe("offline"); // never polled yet
    expect(entry?.screenName).toBe(screen.name);
  });

  it("updates a display's name and screen assignment", async () => {
    const screenA = await seedScreen(db, "Reassign-A");
    const screenB = await seedScreen(db, "Reassign-B");
    const { code } = await createPairingCode(db);
    const display = await claimPairingCode(db, owner, { code, name: "Reassign TV", screenId: screenA.id });

    const updated = await updateDisplay(db, owner, display.id, { name: "Renamed TV", screenId: screenB.id });
    expect(updated.name).toBe("Renamed TV");
    expect(updated.screenId).toBe(screenB.id);

    await expect(updateDisplay(db, staff, display.id, { name: "Nope" })).rejects.toThrow(AuthError);
  });

  it("revoking a display blanks its token and fails future auth", async () => {
    const { code } = await createPairingCode(db);
    const display = await claimPairingCode(db, owner, { code, name: "Revoke TV" });
    const poll = await pollPairingCode(db, code);
    if (poll.status !== "paired") throw new Error("expected paired");

    expect(await verifyDisplayAuth(db, display.id, poll.token)).toBeTruthy();

    const revoked = await revokeDisplay(db, owner, display.id);
    expect(revoked.revokedAt).toBeTruthy();
    expect(revoked.tokenHash).toBeNull();
    expect(await verifyDisplayAuth(db, display.id, poll.token)).toBeNull();

    // Idempotent: revoking an already-revoked display is a no-op, not an error.
    const revokedAgain = await revokeDisplay(db, owner, display.id);
    expect(revokedAgain.revokedAt?.getTime()).toBe(revoked.revokedAt?.getTime());
  });

  it("re-pairing an existing (revoked) display keeps its identity and clears revokedAt", async () => {
    const { code: firstCode } = await createPairingCode(db);
    const display = await claimPairingCode(db, owner, { code: firstCode, name: "Swap TV" });
    await revokeDisplay(db, owner, display.id);

    const { code: secondCode } = await createPairingCode(db);
    const repaired = await claimPairingCode(db, owner, { code: secondCode, existingDisplayId: display.id });
    expect(repaired.id).toBe(display.id);
    expect(repaired.name).toBe("Swap TV");
    expect(repaired.revokedAt).toBeNull();

    const poll = await pollPairingCode(db, secondCode);
    expect(poll.status).toBe("paired");
  });

  it("deletes a display", async () => {
    const { code } = await createPairingCode(db);
    const display = await claimPairingCode(db, owner, { code, name: "Delete TV" });
    await deleteDisplay(db, owner, display.id);
    await expect(getDisplay(db, owner, display.id)).rejects.toThrow(NotFoundError);
  });

  it("records a heartbeat without writing an audit row", async () => {
    const { auditLog } = await import("@/db/schema");
    const { code } = await createPairingCode(db);
    const display = await claimPairingCode(db, owner, { code, name: "Heartbeat TV" });

    const before = await db.select().from(auditLog);
    await recordHeartbeat(db, display.id);
    const after = await db.select().from(auditLog);
    expect(after.length).toBe(before.length);

    const [refreshed] = await db.select().from(displays).where(eq(displays.id, display.id));
    expect(refreshed.lastSeenAt).toBeTruthy();
  });

  it("resolves the current screen via schedule evaluation, falling back to the default", async () => {
    const defaultScreen = await seedScreen(db, "Schedule-default");
    const happyHourScreen = await seedScreen(db, "Schedule-happy-hour");
    const { code } = await createPairingCode(db);
    const display = await claimPairingCode(db, owner, { code, name: "Schedule TV", screenId: defaultScreen.id });

    // No schedule rules yet -> falls back to the default screen.
    const withNoRules = await getCurrentScreenForDisplay(db, display.id);
    expect(withNoRules.screenId).toBe(defaultScreen.id);
    expect(withNoRules.matchedRuleId).toBeNull();

    // A rule covering every day, all day, always wins over the default.
    await createSchedule(db, owner, {
      displayId: display.id,
      days: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: "23:59",
      screenId: happyHourScreen.id,
    });
    const withRule = await getCurrentScreenForDisplay(db, display.id);
    expect(withRule.screenId).toBe(happyHourScreen.id);
    expect(withRule.matchedRuleId).toBeTruthy();
    expect(withRule.screen?.id).toBe(happyHourScreen.id);
  });

  it("revert restores a deleted display", async () => {
    const { auditLog } = await import("@/db/schema");
    const { desc } = await import("drizzle-orm");
    const { code } = await createPairingCode(db);
    const display = await claimPairingCode(db, owner, { code, name: "Revert-delete TV" });
    await deleteDisplay(db, owner, display.id);

    const [deleteEntry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "delete_display"))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    await revertAuditEntry(db, deleteEntry.id, { actor: owner.actor, surface: owner.surface });

    const restored = await getDisplay(db, owner, display.id);
    expect(restored.name).toBe("Revert-delete TV");
  });

  it("reverts a create directly through the generic dispatcher (entityId is populated from after.id at write time)", async () => {
    const { auditLog } = await import("@/db/schema");
    const { desc } = await import("drizzle-orm");
    const { code } = await createPairingCode(db);
    const created = await claimPairingCode(db, owner, { code, name: "Revert-create TV" });

    const [createEntry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "create_display"))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    expect(createEntry.entityId).toBe(created.id);

    await revertAuditEntry(db, createEntry.id, { actor: owner.actor, surface: owner.surface });

    await expect(getDisplay(db, owner, created.id)).rejects.toThrow(NotFoundError);
  });
});
