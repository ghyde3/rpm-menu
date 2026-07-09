// Postgres sliding-window rate limiting (§3.6 — no Redis in Phase 1).
// Isolated in its own lightweight table (not piggybacked on audit_log) to
// avoid write contention against the read-heavy display-poll / public-menu
// paths (per plan risks).
import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** One row per (rate-limit key, window bucket). `bucketStart` is the window
 * truncated to its start instant; `count` is a cheap upsert-incremented
 * counter. See src/lib/rate-limit/index.ts for the helper. */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.key, table.bucketStart] })],
);
