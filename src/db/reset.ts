// Dev convenience: drops and recreates the public schema, then re-applies
// every migration. NEVER point this at a production DATABASE_URL.
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:reset refused to run with NODE_ENV=production");
  }
  console.log("Dropping and recreating public schema...");
  await db.execute(sql`drop schema public cascade`);
  await db.execute(sql`create schema public`);
  // drizzle-kit's migration bookkeeping table lives in its own "drizzle"
  // schema, not "public" — if it survives the reset, the migrator sees each
  // migration's hash already recorded and silently skips re-applying it,
  // leaving `public` empty while `npm run db:migrate` still reports success.
  // Drop it too so a reset always leaves the DB in a truly pre-migration
  // state (confirmed via a fresh reset -> migrate -> table-count check).
  await db.execute(sql`drop schema if exists drizzle cascade`);
  console.log("Schema reset. Run `npm run db:migrate` next.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
