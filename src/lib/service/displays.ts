// TV pairing + runtime + admin management (PRD §3.3, §3.2a, §3.8 Displays
// tab). Zod validation lives inline (this unit's owns_paths don't include
// src/lib/validation/**, mirroring settings/venue.ts's documented stance).
//
// Pairing-token handoff design note: PRD §3.3 requires a "long-lived,
// revocable, read-only display token" delivered to the TV once it's paired.
// Rather than staging the plaintext token in an extra table/column (schema
// is foundation-owned; no scratch column exists) or an in-memory map (lost
// on restart, and wrong under multiple server instances), token issuance is
// deferred to the TV's OWN next poll of its pairing code: `claimPairingCode`
// (admin-side) only creates the `displays` row and links the pairing code to
// it — no token yet. `pollPairingCode` (TV-side, called repeatedly while the
// code is on screen) is the ONLY place a token is ever minted, exactly once,
// via an atomic `UPDATE ... WHERE token_hash IS NULL` guard so a race
// between two pollers can't mint two tokens for one display. This needs no
// extra storage, survives process restarts, and never exposes the plaintext
// to the admin's browser at all — only the TV that's holding the code sees
// it.
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { displays, pairingCodes, screens, venueSettings, VENUE_SETTINGS_ID } from "@/db/schema";
import {
  requireOwnerCaller,
  withAudit,
  bumpAffectedScreens,
  registerRevertHandler,
  reviveDates,
  type DbClient,
  type ServiceCaller,
} from "./base";
import { NotFoundError, ConflictError } from "./base/errors";
import { generateDisplayToken, verifyDisplayToken as verifyTokenHash, generatePairingCode } from "@/lib/auth/display-token";
import { evaluateSchedule, type ScheduleRule } from "@/lib/schedules/evaluate";
import { listSchedulesForDisplay } from "./schedules";
import type { Screen } from "./screens";

export type Display = typeof displays.$inferSelect;
export type PairingCodeRow = typeof pairingCodes.$inferSelect;

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes (§3.3: short-lived pairing).

// --- Heartbeat status (§3.8: "green <2 min, yellow <10, red offline") -----

export type HeartbeatStatus = "online" | "warning" | "offline";

export function computeHeartbeatStatus(lastSeenAt: Date | null, now: Date = new Date()): HeartbeatStatus {
  if (!lastSeenAt) return "offline";
  const minutes = (now.getTime() - lastSeenAt.getTime()) / 60_000;
  if (minutes < 2) return "online";
  if (minutes < 10) return "warning";
  return "offline";
}

// --- Pairing code lifecycle (TV-initiated, unauthenticated) ---------------

async function codeExists(db: DbClient, code: string): Promise<boolean> {
  const [row] = await db.select({ code: pairingCodes.code }).from(pairingCodes).where(eq(pairingCodes.code, code));
  return !!row;
}

async function generateUniqueCode(db: DbClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generatePairingCode();
    if (!(await codeExists(db, code))) return code;
  }
  throw new ConflictError("Could not generate a unique pairing code — try again.");
}

/** TV calls this on first load (no existing token in localStorage) to get a
 * fresh 6-character pairing code to display (§3.3). Unauthenticated by
 * design — anyone can request a code, but a code alone grants nothing until
 * an owner claims it, and claiming requires an authenticated owner session. */
export async function createPairingCode(db: DbClient): Promise<{ code: string; expiresAt: Date }> {
  const code = await generateUniqueCode(db);
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
  await db.insert(pairingCodes).values({ code, expiresAt });
  return { code, expiresAt };
}

export type PairingPollResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "not_found" }
  | { status: "paired"; token: string; displayId: string }
  | { status: "already_issued"; displayId: string };

/**
 * TV polls this repeatedly while its pairing code is on screen (§3.3). Once
 * an owner has claimed the code (`claimPairingCode` below), the FIRST poll to
 * see it claimed mints and returns the one-time plaintext token — see this
 * module's header comment for why token issuance lives here rather than at
 * claim time.
 */
export async function pollPairingCode(db: DbClient, code: string): Promise<PairingPollResult> {
  const [row] = await db.select().from(pairingCodes).where(eq(pairingCodes.code, code));
  if (!row) return { status: "not_found" };

  if (!row.claimedDisplayId) {
    if (row.expiresAt < new Date()) return { status: "expired" };
    return { status: "pending" };
  }

  const displayId = row.claimedDisplayId;
  const { plaintext, hash } = generateDisplayToken();

  const [issued] = await db
    .update(displays)
    .set({ tokenHash: hash, pairedAt: new Date(), revokedAt: null })
    .where(and(eq(displays.id, displayId), isNull(displays.tokenHash)))
    .returning({ id: displays.id });

  if (issued) {
    // Pairing code is single-use once it has done its job — delete it so it
    // can't be replayed to re-derive anything (the derived value is now a
    // hash-only secret the code itself no longer participates in).
    await db.delete(pairingCodes).where(eq(pairingCodes.code, code));
    return { status: "paired", token: plaintext, displayId };
  }

  // Lost the race (another poll already minted the token) — or this code was
  // reused for a "reclaim existing display" flow whose display already has a
  // token. Either way, no new token to hand out from here.
  return { status: "already_issued", displayId };
}

// --- Admin claim (owner-only) ---------------------------------------------

const claimPairingCodeSchema = z.object({
  // Normalized to uppercase here (not just at the admin-UI form layer) so
  // any future caller of this service function (REST/MCP, §3.7) gets the
  // same forgiving behavior rather than a confusing "not found" for a
  // lowercase-typed code.
  code: z.string().length(6).transform((c) => c.toUpperCase()),
  name: z.string().min(1).max(200).optional(),
  screenId: z.uuid().nullable().optional(),
  /** Re-pair an existing (e.g. revoked, or physically swapped) display
   * rather than creating a new one — preserves its name + schedule. */
  existingDisplayId: z.uuid().optional(),
});
export type ClaimPairingCodeInput = z.input<typeof claimPairingCodeSchema>;

async function getPairingCodeOrThrow(db: DbClient, code: string): Promise<PairingCodeRow> {
  const [row] = await db.select().from(pairingCodes).where(eq(pairingCodes.code, code));
  if (!row) throw new NotFoundError("pairing_code", code);
  if (row.claimedDisplayId) throw new ConflictError("Pairing code has already been claimed.");
  if (row.expiresAt < new Date()) throw new ConflictError("Pairing code has expired — ask the TV for a new one.");
  return row;
}

/**
 * Owner enters the code shown on a TV, names the display, and assigns a
 * default screen (§3.3: "owner enters code in admin UI and assigns a
 * screen"). Does NOT mint a token — see this module's header comment. When
 * `existingDisplayId` is given, re-links the code to that display instead of
 * creating a new row (re-pair flow: keeps the display's name/schedule after
 * a revoke or a physical device swap).
 */
export async function claimPairingCode(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: ClaimPairingCodeInput,
): Promise<Display> {
  requireOwnerCaller(caller);
  const input = claimPairingCodeSchema.parse(rawInput);
  const pairingRow = await getPairingCodeOrThrow(db, input.code);

  if (input.screenId) {
    const [screenRow] = await db.select({ id: screens.id }).from(screens).where(eq(screens.id, input.screenId));
    if (!screenRow) throw new NotFoundError("screen", input.screenId);
  }

  if (input.existingDisplayId) {
    const [existing] = await db.select().from(displays).where(eq(displays.id, input.existingDisplayId));
    if (!existing) throw new NotFoundError("display", input.existingDisplayId);

    const updated = await withAudit(
      db,
      {
        actor: caller.actor,
        surface: caller.surface,
        action: "repair_display",
        entityType: "display",
        entityId: existing.id,
        before: existing,
      },
      async () => {
        const [after] = await db
          .update(displays)
          .set({ revokedAt: null, tokenHash: null })
          .where(eq(displays.id, existing.id))
          .returning();
        return { result: after, after };
      },
    );
    await db
      .update(pairingCodes)
      .set({ claimedDisplayId: updated.id })
      .where(eq(pairingCodes.code, pairingRow.code));
    await bumpAffectedScreens(db, { screenIds: updated.screenId ? [updated.screenId] : [] });
    return updated;
  }

  const created = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_display",
      entityType: "display",
      entityId: null,
      before: null,
    },
    async () => {
      const [after] = await db
        .insert(displays)
        .values({ name: input.name ?? "New Display", screenId: input.screenId ?? null })
        .returning();
      return { result: after, after };
    },
  );

  await db.update(pairingCodes).set({ claimedDisplayId: created.id }).where(eq(pairingCodes.code, pairingRow.code));
  await bumpAffectedScreens(db, { screenIds: created.screenId ? [created.screenId] : [] });
  return created;
}

// --- Reads (owner-only: surfaced only in the owner-only Displays settings
// tab, §3.8) ----------------------------------------------------------------

export interface DisplayWithStatus extends Display {
  heartbeat: HeartbeatStatus;
  screenName: string | null;
}

export async function listDisplays(db: DbClient, caller: ServiceCaller): Promise<DisplayWithStatus[]> {
  requireOwnerCaller(caller);
  const rows = await db.select().from(displays);
  const screenIds = Array.from(new Set(rows.map((r) => r.screenId).filter((id): id is string => !!id)));
  const screenRows = screenIds.length
    ? await db.select({ id: screens.id, name: screens.name }).from(screens)
    : [];
  const nameById = new Map(screenRows.map((s) => [s.id, s.name]));
  const now = new Date();
  return rows.map((row) => ({
    ...row,
    heartbeat: computeHeartbeatStatus(row.lastSeenAt, now),
    screenName: row.screenId ? (nameById.get(row.screenId) ?? null) : null,
  }));
}

async function getDisplayOrThrow(db: DbClient, id: string): Promise<Display> {
  const [row] = await db.select().from(displays).where(eq(displays.id, id));
  if (!row) throw new NotFoundError("display", id);
  return row;
}

export async function getDisplay(db: DbClient, caller: ServiceCaller, id: string): Promise<Display> {
  requireOwnerCaller(caller);
  return getDisplayOrThrow(db, id);
}

// --- Mutations (owner-only) -------------------------------------------

const updateDisplaySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  screenId: z.uuid().nullable().optional(),
});
export type UpdateDisplayInput = z.infer<typeof updateDisplaySchema>;

/** Renames a display and/or reassigns its default screen ("Reassignment:
 * owner can point a paired display at a different screen from the admin,
 * remotely," §3.3). */
export async function updateDisplay(
  db: DbClient,
  caller: ServiceCaller,
  id: string,
  rawInput: UpdateDisplayInput,
): Promise<Display> {
  requireOwnerCaller(caller);
  const input = updateDisplaySchema.parse(rawInput);
  const before = await getDisplayOrThrow(db, id);

  if (input.screenId) {
    const [screenRow] = await db.select({ id: screens.id }).from(screens).where(eq(screens.id, input.screenId));
    if (!screenRow) throw new NotFoundError("screen", input.screenId);
  }

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "update_display",
      entityType: "display",
      entityId: id,
      before,
    },
    async () => {
      const [after] = await db.update(displays).set(input).where(eq(displays.id, id)).returning();
      return { result: after, after };
    },
  );

  const affectedScreenIds = Array.from(
    new Set([before.screenId, updated.screenId].filter((s): s is string => !!s)),
  );
  await bumpAffectedScreens(db, { screenIds: affectedScreenIds });
  return updated;
}

/** "Revoking a token blanks that TV to a re-pair screen on its next poll"
 * (§3.8). Clears the token hash too (belt-and-suspenders: a revoked display
 * fails auth even if some caller ever forgot to check `revokedAt`). */
export async function revokeDisplay(db: DbClient, caller: ServiceCaller, id: string): Promise<Display> {
  requireOwnerCaller(caller);
  const before = await getDisplayOrThrow(db, id);
  if (before.revokedAt) return before;

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "revoke_display",
      entityType: "display",
      entityId: id,
      before,
    },
    async () => {
      const [after] = await db
        .update(displays)
        .set({ revokedAt: new Date(), tokenHash: null })
        .where(eq(displays.id, id))
        .returning();
      return { result: after, after };
    },
  );

  await bumpAffectedScreens(db, {});
  return updated;
}

export async function deleteDisplay(db: DbClient, caller: ServiceCaller, id: string): Promise<void> {
  requireOwnerCaller(caller);
  const before = await getDisplayOrThrow(db, id);

  await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "delete_display",
      entityType: "display",
      entityId: id,
      before,
    },
    async () => {
      // display_schedules rows cascade (ON DELETE CASCADE, src/db/schema/
      // displays.ts) — no separate cleanup needed here.
      await db.delete(displays).where(eq(displays.id, id));
      return { result: undefined, after: null };
    },
  );

  await bumpAffectedScreens(db, {});
}

// --- Runtime surface (actor = "display", pre-authorized by token
// verification in the route handler BEFORE any service call — see
// src/lib/service/base/caller.ts's module doc) -----------------------------

/**
 * Verifies a bearer token against one display's stored hash. Returns the
 * display row on success, or `null` on any failure (not found, revoked, no
 * token ever issued, hash mismatch) — callers should treat every `null` the
 * same way (401 -> TV clears localStorage and re-pairs) rather than leaking
 * which specific check failed.
 */
export async function verifyDisplayAuth(db: DbClient, displayId: string, token: string): Promise<Display | null> {
  const [row] = await db.select().from(displays).where(eq(displays.id, displayId));
  if (!row) return null;
  if (row.revokedAt) return null;
  if (!row.tokenHash) return null;
  if (!verifyTokenHash(token, row.tokenHash)) return null;
  return row;
}

/** Heartbeat write (§3.8's "last-seen heartbeat"). Deliberately NOT run
 * through `withAudit`/`bumpAffectedScreens` — this fires every poll (every
 * 15-30s per display), and auditing pure telemetry would flood `audit_log`
 * with rows nobody needs to see or revert, contradicting §3.5's "retention:
 * keep everything; volume is trivial at this scale" (that stance assumes
 * meaningful mutations, not a heartbeat clock). */
export async function recordHeartbeat(db: DbClient, displayId: string): Promise<void> {
  await db.update(displays).set({ lastSeenAt: new Date() }).where(eq(displays.id, displayId));
}

export interface CurrentScreenResult {
  screenId: string | null;
  screen: Screen | null;
  matchedRuleId: string | null;
}

/**
 * Resolves what a display should be showing RIGHT NOW: evaluates its weekly
 * schedule against the venue's timezone (§3.2a), falling back to the
 * display's own default `screenId` when no rule matches. Called fresh on
 * every poll — no caching, so a schedule edit takes effect on the display's
 * very next poll with no separate "bump" needed.
 */
export async function getCurrentScreenForDisplay(db: DbClient, displayId: string): Promise<CurrentScreenResult> {
  const display = await getDisplayOrThrow(db, displayId);
  const scheduleRows = await listSchedulesForDisplay(db, displayId);
  const rules: ScheduleRule[] = scheduleRows.map((r) => ({
    id: r.id,
    days: r.days,
    startTime: r.startTime,
    endTime: r.endTime,
    screenId: r.screenId,
    priority: r.priority,
  }));

  const [venue] = await db.select({ timezone: venueSettings.timezone }).from(venueSettings).where(
    eq(venueSettings.id, VENUE_SETTINGS_ID),
  );
  const timezone = venue?.timezone ?? "America/Chicago";

  const { screenId, matchedRuleId } = evaluateSchedule({
    rules,
    defaultScreenId: display.screenId,
    now: new Date(),
    timezone,
  });

  if (!screenId) return { screenId: null, screen: null, matchedRuleId };

  const [screen] = await db.select().from(screens).where(eq(screens.id, screenId));
  return { screenId, screen: screen ?? null, matchedRuleId };
}

// --- Revert registration ----------------------------------------------

registerRevertHandler("display", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("display revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(displays).where(eq(displays.id, ctx.entityId));
    return;
  }
  const beforeRow = reviveDates(ctx.before as Display, ["pairedAt", "lastSeenAt", "revokedAt", "createdAt"]);
  const existing = await db.select({ id: displays.id }).from(displays).where(eq(displays.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(displays).values(beforeRow);
  } else {
    await db.update(displays).set(beforeRow).where(eq(displays.id, ctx.entityId));
  }
});
