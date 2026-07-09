import { defineConfig } from "drizzle-kit";

// Migrations are plain Postgres-dialect SQL, so the same output directory
// works whether the runtime driver is `pg` (Docker/Neon/Railway) or
// `@electric-sql/pglite` (dev fallback with no Docker) — see src/db/index.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/rpm_menu",
  },
});
