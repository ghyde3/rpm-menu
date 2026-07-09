// PRD §5.1 + §3.5/§4.2 + addendum §2: every mutation writes one row here.
// Owned by foundation — this is THE shared registry; no feature unit invents
// ad hoc `entity_type` or `surface` strings (per plan conventions).
import { check, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const actorTypeEnum = ["user", "display", "system"] as const;
export type ActorType = (typeof actorTypeEnum)[number];

/** `admin_ui` is the only Phase 1 surface in active use; `api` and `mcp` are
 * used by the M3 REST/MCP units; `slack`/`discord`/`sms` are reserved for
 * Phase 2 per §4.2's architectural commitments. */
export const surfaceEnum = ["admin_ui", "api", "mcp", "slack", "discord", "sms", "system"] as const;
export type Surface = (typeof surfaceEnum)[number];

/** Fixed registry (addendum §2, PRD §4.2) — never ad hoc strings per feature. */
export const ENTITY_TYPES = [
  "item",
  "category",
  "tag",
  "modifier_group",
  "modifier_option",
  "modifier_group_attachment",
  "item_modifier_option_exclusion",
  "screen",
  "display",
  "display_schedule",
  "api_key",
  "setting",
  "pending_change",
  "user",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: text("actor_type", { enum: actorTypeEnum }).notNull(),
    actorId: uuid("actor_id"),
    surface: text("surface", { enum: surfaceEnum }).notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type", { enum: ENTITY_TYPES }).notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("audit_log_actor_type_check", sql`${table.actorType} in ('user','display','system')`),
    check(
      "audit_log_surface_check",
      sql`${table.surface} in (${sql.raw(surfaceEnum.map((s) => `'${s}'`).join(","))})`,
    ),
    check(
      "audit_log_entity_type_check",
      sql`${table.entityType} in (${sql.raw(ENTITY_TYPES.map((t) => `'${t}'`).join(","))})`,
    ),
  ],
);
