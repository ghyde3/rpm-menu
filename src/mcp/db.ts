// The MCP server's own DB client construction -- deliberately NOT
// `import { db } from "@/db"`. That module instantiates its driver as an
// import-time side effect, which would construct (and thus open) a PGlite
// client before this process gets a chance to check the single-writer lock
// (src/mcp/pglite-lock.ts). Driver selection otherwise mirrors
// src/db/index.ts exactly (`DATABASE_URL` -> `pg`; unset or
// `DB_DRIVER=pglite` -> `@electric-sql/pglite`) so the MCP server "works
// when pointed at the same DATABASE_URL as the app" per this unit's spec --
// same connection string, same schema, same migrations.
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as dbSchema from "@/db/schema";
import type { Database } from "@/db";
import { acquirePgliteLock, type AcquiredPgliteLock } from "./pglite-lock";

export interface McpDbHandle {
  db: Database;
  /** Set only when running against PGlite -- call on shutdown to release
   * the advisory lock. `null` for the Postgres driver (nothing to release;
   * a real Postgres server already handles concurrent connections). */
  pgliteLock: AcquiredPgliteLock | null;
}

function isPgliteMode(): boolean {
  return process.env.DB_DRIVER === "pglite" || !process.env.DATABASE_URL;
}

/**
 * Builds the MCP server's DB client, refusing to start against a PGlite data
 * directory another live process already holds (`PgliteLockError` -- see
 * pglite-lock.ts). Call once at process startup, before authenticating the
 * API key.
 */
export function createMcpDb(): McpDbHandle {
  if (isPgliteMode()) {
    const dataDir = process.env.PGLITE_DATA_DIR ?? ".data/pglite";
    const pgliteLock = acquirePgliteLock(dataDir);
    try {
      const client = new PGlite(dataDir);
      const db = drizzlePglite({ client, schema: dbSchema }) as unknown as Database;
      return { db, pgliteLock };
    } catch (err) {
      pgliteLock.release();
      throw err;
    }
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzlePg({ client: pool, schema: dbSchema });
  return { db, pgliteLock: null };
}
