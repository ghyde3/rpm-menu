import { describe, expect, it, beforeAll } from "vitest";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { users } from "@/db/schema";
import {
  createPendingChange,
  getPendingChange,
  getFreshPendingChangeOrThrow,
  listPendingChanges,
  markPendingChangeApplied,
  cancelPendingChange,
  PENDING_CHANGE_TTL_MS,
} from "./pending-changes";
import type { ServiceCaller } from "./base";

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

const noRole: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000cc" },
  surface: "admin_ui",
  role: undefined,
  isActive: true,
};

describe("pending-changes service", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDb();
    // pending_changes.actor_id FKs to users.id -- seed matching rows for
    // every fixed test-caller id used below.
    await db.insert(users).values([
      { id: owner.actor.id!, email: "owner@test.local", name: "Owner", role: "owner" },
      { id: staff.actor.id!, email: "staff@test.local", name: "Staff", role: "staff" },
    ]);
  });

  it("creates a pending row with a 15-minute default expiry", async () => {
    const before = Date.now();
    const row = await createPendingChange(db, staff, { changeType: "bulk_set_availability", payload: { a: 1 } });
    expect(row.status).toBe("pending");
    expect(row.changeType).toBe("bulk_set_availability");
    expect(row.payload).toEqual({ a: 1 });
    expect(row.expiresAt.getTime() - before).toBeGreaterThanOrEqual(PENDING_CHANGE_TTL_MS - 1000);
    expect(row.expiresAt.getTime() - before).toBeLessThanOrEqual(PENDING_CHANGE_TTL_MS + 5000);
  });

  it("rejects creation from an unauthenticated/roleless actor", async () => {
    await expect(
      createPendingChange(db, noRole, { changeType: "bulk_set_availability", payload: {} }),
    ).rejects.toThrow();
  });

  it("round-trips through getPendingChange and 404s on an unknown id", async () => {
    const row = await createPendingChange(db, staff, { changeType: "bulk_tag", payload: { x: true } });
    const fetched = await getPendingChange(db, row.id);
    expect(fetched.id).toBe(row.id);

    await expect(getPendingChange(db, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });

  it("lists pending changes filterable by status and changeType", async () => {
    await createPendingChange(db, staff, { changeType: "bulk_set_category", payload: {} });
    const applied = await createPendingChange(db, staff, { changeType: "bulk_price_adjust", payload: {} });
    await markPendingChangeApplied(db, applied.id);

    const pendingOnly = await listPendingChanges(db, { status: "pending" });
    expect(pendingOnly.every((r) => r.status === "pending")).toBe(true);

    const priceAdjustOnly = await listPendingChanges(db, { changeType: "bulk_price_adjust" });
    expect(priceAdjustOnly.some((r) => r.id === applied.id)).toBe(true);
  });

  it("getFreshPendingChangeOrThrow flips an expired row to 'expired' and rejects apply", async () => {
    const row = await createPendingChange(db, staff, {
      changeType: "bulk_set_availability",
      payload: {},
      ttlMs: -1000, // already expired
    });

    await expect(getFreshPendingChangeOrThrow(db, row.id)).rejects.toThrow(/expired|not "pending"/i);

    const reloaded = await getPendingChange(db, row.id);
    expect(reloaded.status).toBe("expired");
  });

  it("getFreshPendingChangeOrThrow passes through a live pending row unchanged", async () => {
    const row = await createPendingChange(db, staff, { changeType: "bulk_set_availability", payload: {} });
    const fresh = await getFreshPendingChangeOrThrow(db, row.id);
    expect(fresh.id).toBe(row.id);
    expect(fresh.status).toBe("pending");
  });

  it("markPendingChangeApplied merges a patch into payload and flips status", async () => {
    const row = await createPendingChange(db, staff, {
      changeType: "bulk_set_availability",
      payload: { input: { foo: "bar" } },
    });
    const applied = await markPendingChangeApplied(db, row.id, { appliedCount: 3 });
    expect(applied.status).toBe("applied");
    expect(applied.payload).toEqual({ input: { foo: "bar" }, appliedCount: 3 });
  });

  it("cancelPendingChange cancels a pending row and refuses a non-pending one", async () => {
    const row = await createPendingChange(db, staff, { changeType: "bulk_set_availability", payload: {} });
    const cancelled = await cancelPendingChange(db, owner, row.id);
    expect(cancelled.status).toBe("cancelled");

    await expect(cancelPendingChange(db, owner, row.id)).rejects.toThrow();
  });
});
