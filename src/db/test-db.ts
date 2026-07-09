// Test-only helper: spins up an in-memory PGlite instance and applies the
// real drizzle-kit migrations, so service-layer tests exercise the exact
// same schema/constraints as dev and prod rather than a hand-rolled subset.
// Never imported from application code — only from `*.test.ts` files.
import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Database } from "./index";

export async function createTestDb(): Promise<Database> {
  const client = new PGlite();
  const db = drizzle({ client, schema }) as unknown as Database;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: "./drizzle/migrations" });
  return db;
}
