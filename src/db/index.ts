// Single Drizzle client, driver chosen at runtime by env:
//   - DATABASE_URL set        -> real Postgres via `pg` (Docker Compose in
//                                dev, Neon/Railway in prod).
//   - DB_DRIVER=pglite (or no -> @electric-sql/pglite, an in-process
//     DATABASE_URL at all)       Postgres-compatible engine, for dev boxes
//                                without Docker. Data persists under .data/
//                                (gitignored).
// Both paths run the exact same drizzle-kit-generated SQL migrations
// (src/db/schema, drizzle.config.ts) because PGlite speaks the Postgres
// wire/SQL dialect.
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import * as dbSchema from "./schema";

// Both drivers implement the same drizzle-orm/pg-core query-builder surface
// (select/insert/update/delete/execute/transaction) — the only difference is
// which session/driver executes the SQL underneath. Typing `Database` as a
// union of NodePgDatabase | PgliteDatabase defeats TypeScript's overload
// resolution on chained builder calls (e.g. `.insert(...).returning({...})`
// collapses to its 0-arg overload across a union). So we type this as the
// concrete NodePgDatabase shape everywhere and cast the PGlite instance to
// match — safe because call sites never touch driver-specific internals.
export type Database = NodePgDatabase<typeof dbSchema>;

const PGLITE_DATA_DIR = process.env.PGLITE_DATA_DIR ?? ".data/pglite";

declare global {
  var __rpmDb: Database | undefined;
  var __rpmPgPool: Pool | undefined;
}

function createDb(): Database {
  const useDriver = process.env.DB_DRIVER;
  const databaseUrl = process.env.DATABASE_URL;

  if (useDriver === "pglite" || !databaseUrl) {
    mkdirSync(PGLITE_DATA_DIR, { recursive: true });
    const client = new PGlite(PGLITE_DATA_DIR);
    return drizzlePglite({ client, schema: dbSchema }) as unknown as Database;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  globalThis.__rpmPgPool = pool;
  return drizzlePg({ client: pool, schema: dbSchema });
}

// Cache on globalThis so Next.js dev-mode module reloads (and PGlite's
// single-writer-process constraint) don't spin up a second client.
export const db: Database = globalThis.__rpmDb ?? createDb();
if (process.env.NODE_ENV !== "production") {
  globalThis.__rpmDb = db;
}

export const isPglite = () => process.env.DB_DRIVER === "pglite" || !process.env.DATABASE_URL;

export * as schema from "./schema";
