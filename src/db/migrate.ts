// Runs the drizzle-kit-generated SQL migrations (drizzle/migrations)
// against whichever driver `src/db/index.ts` selected. Used by `npm run
// db:migrate` and by db:reset.
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { db, isPglite } from "./index";

async function main() {
  const migrationsFolder = "./drizzle/migrations";
  if (isPglite()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePglite(db as any, { migrationsFolder });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePg(db as any, { migrationsFolder });
  }
  console.log(`Migrations applied (${isPglite() ? "pglite" : "postgres"}).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
