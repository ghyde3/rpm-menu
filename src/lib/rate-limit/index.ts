// Postgres sliding-window rate limiter (§3.6) — no Redis in Phase 1.
// Used by both the public-menu/display-poll paths (per-IP) and the REST API
// (per-API-key). Isolated in its own table (rate_limit_buckets) so it never
// contends with audit_log's write path.
import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { rateLimitBuckets } from "@/db/schema";

export interface RateLimitOptions {
  /** Unique key for the thing being limited, e.g. `api-key:<id>` or `ip:<addr>`. */
  key: string;
  /** Sliding window size, in seconds. */
  windowSeconds: number;
  /** Max requests allowed within the window. */
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests counted within the current window, including this one if allowed. */
  count: number;
  limit: number;
  /** Seconds until the oldest bucket in the window falls out of it. */
  retryAfterSeconds: number;
}

/** Truncates `date` down to the start of its `windowSeconds` bucket, so
 * repeated calls within the same bucket cheaply upsert-increment one row
 * instead of inserting a row per request. */
function bucketStart(date: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

/**
 * Sliding-window-ish rate limit: counts requests across all buckets touched
 * in the last `windowSeconds`, keyed by `key`. Cheap upsert on the write
 * path; a periodic cron/cleanup (not required for correctness) can prune
 * buckets older than the longest window in use.
 */
export async function checkRateLimit(db: Database, options: RateLimitOptions): Promise<RateLimitResult> {
  const now = new Date();
  const bucket = bucketStart(now, options.windowSeconds);
  const windowStart = new Date(now.getTime() - options.windowSeconds * 1000);

  await db
    .insert(rateLimitBuckets)
    .values({ key: options.key, bucketStart: bucket, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.bucketStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    });

  const rows = await db
    .select({ count: rateLimitBuckets.count })
    .from(rateLimitBuckets)
    .where(and(eq(rateLimitBuckets.key, options.key), gte(rateLimitBuckets.bucketStart, windowStart)));

  const count = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    allowed: count <= options.limit,
    count,
    limit: options.limit,
    retryAfterSeconds: options.windowSeconds,
  };
}
