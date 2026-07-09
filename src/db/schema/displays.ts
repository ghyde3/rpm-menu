// PRD §5.1 + §3.2a/§3.3: TV pairing, tokens, weekly schedules.
// Owned by foundation (schema); pairing/runtime/scheduling logic lives in the
// displays unit (src/lib/service/displays.ts, src/lib/service/schedules.ts).
import { integer, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { screens } from "./screens";

export const displays = pgTable("displays", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Default screen shown when no schedule rule matches (§3.2a).
  screenId: uuid("screen_id").references(() => screens.id, { onDelete: "set null" }),
  tokenHash: text("token_hash"),
  pairedAt: timestamp("paired_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Ordered weekly rule set per display: `(days, start_time, end_time) ->
 * screen`, evaluated server-side against venue-local timezone (§3.2a). */
export const displaySchedules = pgTable("display_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayId: uuid("display_id")
    .notNull()
    .references(() => displays.id, { onDelete: "cascade" }),
  // 0 = Sunday .. 6 = Saturday.
  days: integer("days").array().notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  screenId: uuid("screen_id")
    .notNull()
    .references(() => screens.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
});

/** Short-lived pairing code a TV displays on first boot (§3.3). */
export const pairingCodes = pgTable("pairing_codes", {
  code: text("code").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  claimedDisplayId: uuid("claimed_display_id").references(() => displays.id, { onDelete: "cascade" }),
});
