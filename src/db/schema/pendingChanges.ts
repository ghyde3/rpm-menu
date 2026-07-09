// PRD §5.1 + §3.7/§4.2: preview→apply flow shared by bulk ops (Phase 1) and
// chat confirmations (Phase 2). Owned by foundation (schema); the
// create/apply/expire logic lives in src/lib/service/pending-changes.ts.
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const pendingChangeStatusEnum = ["pending", "applied", "expired", "cancelled"] as const;
export type PendingChangeStatus = (typeof pendingChangeStatusEnum)[number];

export const pendingChanges = pgTable("pending_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  changeType: text("change_type").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status", { enum: pendingChangeStatusEnum }).notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
