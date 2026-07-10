# RPM Menu CMS

## What this is

A menu CMS + TV display platform for RPM Pub, built end-to-end across four
phases (foundation, M1, M2, M3) per `menu-cms-prd.md` (full product scope)
and `menu-cms-data-model-addendum.md` (schema/pricing decisions):

- **Admin UI** (`/admin/**`, dark-only, RPM Pub Design System tokens) — CRUD
  for items/categories/tags/modifier groups, 86/un-86 toggles, bulk price
  operations with a mandatory preview/apply step, TV screen + display
  pairing/scheduling, an audit log with one-click revert, venue settings,
  branding, QR-code generation, and API-key management.
- **Public menu** (`/menu`) — a read-only, server-rendered guest-facing menu.
  Prices only ever render through `src/lib/pricing.ts`'s fail-safe (an
  `ambiguous`-priced item never shows a price at all), and only `public`-
  visibility tags are ever shown — private/internal tags (e.g. `domestic`,
  `happy-hour-eligible`) never leak here.
- **TV displays** (`/display`, `/display/render`) — pairing-code flow for
  Fire Stick–class devices (`docs/runbook-fire-stick.md`), polling-based
  screen rendering with offline resilience and a 4am nightly reload.
- **REST API** (`/api/v1/**`) — bearer-key-authenticated, scoped
  (`read`/`write:availability`/`write:items`/`write:prices`/`write:screens`),
  for external integrations.
- **MCP server** (`src/mcp/**`, `npm run mcp`) — the same service layer again,
  exposed as 9 MCP tools over stdio so an AI client (Claude Desktop, Claude
  Code, etc.) can search the menu, 86 an item, adjust prices (behind a
  two-step preview/apply confirmation), and read the audit log. See
  `docs/mcp-server.md` for the tool table and connection instructions.

Every mutation, from any of the three surfaces (admin UI, REST, MCP), runs
through the same `src/lib/service/**` functions and is written to the audit
log via `withAudit` — see `docs/architecture.md` for the full architecture.

## How to run

```bash
cp .env.example .env   # fill in BETTER_AUTH_SECRET, SEED_OWNER_EMAIL/PASSWORD

# Dev database — either:
docker compose up -d   # Postgres 16 on localhost:55432, or
# leave DATABASE_URL unset (or set DB_DRIVER=pglite) to use the built-in
# PGlite fallback — no Docker required. This is .env.example's default.

npm install
npm run db:migrate
npm run db:seed        # creates the venue settings row, first owner account,
                        # and imports the real menu (rpm-menu-extracted.md +
                        # rpm-drinks-extracted.md) with hard assertions
npm run dev             # http://localhost:3000 — sign in at /login
```

Sign in with `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` from your `.env`
(if you left `SEED_OWNER_PASSWORD` unset or on its placeholder value,
`db:seed` generates one and writes it back into `.env` for you — check there
after seeding).

## How to demo

The flagship demo is **"Claude 86ing an item live, via MCP"** — connect
Claude Desktop to the MCP server with a scoped API key, then ask it in plain
English to 86 an item ("we're out of Coors"); the paired TV updates within
one poll cycle, with no admin dashboard involved. Full setup checklist,
connector config, and a word-for-word script (including the two-step
preview/apply confirmation for bulk price changes, and pulling the audit
trail afterward) live in `docs/demo-script.md`. To try the REST API instead,
create a key under **Settings → API Keys** and call `/api/v1/items` with
`Authorization: Bearer <key>`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run a production build (`npm run build` first) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema/**` |
| `npm run db:migrate` | Apply migrations (Postgres or PGlite, whichever is active) |
| `npm run db:seed` | Create venue settings + first owner account + import the real menu |
| `npm run db:reset` | **Dev only** — drop and recreate the public schema |
| `npm run mcp` | Start the MCP server (`MCP_API_KEY` required) — see `docs/mcp-server.md` |

## Project structure

See `docs/architecture.md` for the full breakdown. Key rule: **the design
system is the single source of truth for UI** — all styling uses
`RPM Pub Design System` CSS tokens (`var(--...)`) via `src/styles/**`, never
hardcoded values or Tailwind. `RPM Pub Design System/ui_kits/menu-data.js`
is a demo fixture and is never used as data.
