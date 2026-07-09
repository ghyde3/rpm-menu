# RPM Menu CMS

Menu CMS + TV display platform for RPM Pub. See `menu-cms-prd.md` and
`menu-cms-data-model-addendum.md` at the repo root for full product scope,
and `docs/architecture.md` for stack decisions and folder conventions.

## Quickstart

```bash
cp .env.example .env   # fill in BETTER_AUTH_SECRET, SEED_OWNER_EMAIL/PASSWORD

# Dev database — either:
docker compose up -d   # Postgres 16 on localhost:55432, or
# leave DATABASE_URL unset (or set DB_DRIVER=pglite) to use the built-in
# PGlite fallback — no Docker required. This is .env.example's default.

npm install
npm run db:migrate
npm run db:seed        # creates the first owner account
npm run dev             # http://localhost:3000 — sign in at /login
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema/**` |
| `npm run db:migrate` | Apply migrations (Postgres or PGlite, whichever is active) |
| `npm run db:seed` | Create the venue settings row + first owner account |
| `npm run db:reset` | **Dev only** — drop and recreate the public schema |

## Project structure

See `docs/architecture.md` for the full breakdown. Key rule: **the design
system is the single source of truth for UI** — all styling uses
`RPM Pub Design System` CSS tokens (`var(--...)`) via `src/styles/**`, never
hardcoded values or Tailwind. `RPM Pub Design System/ui_kits/menu-data.js`
is a demo fixture and is never used as data.
