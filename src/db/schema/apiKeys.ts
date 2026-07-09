// PRD §5.1 + §3.7/§3.8: owner-managed API keys with scopes. Owned by
// foundation (schema + hash primitive at src/lib/api-keys/hash.ts); admin UI
// and REST auth middleware live in their respective units.
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Per §3.7 — no `settings-write` scope exists anywhere in Phase 1. */
export const API_KEY_SCOPES = [
  "read",
  "write:availability",
  "write:items",
  "write:prices",
  "write:screens",
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: text("scopes").array().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
