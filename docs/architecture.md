# Architecture

Foundation scaffold for the RPM Menu CMS. This document records the stack
decisions, folder conventions, and how to run the app locally. See the repo
root for the source-of-truth product docs: `menu-cms-prd.md`,
`menu-cms-data-model-addendum.md`, `rpm-menu-extracted.md`,
`rpm-drinks-extracted.md`, and `RPM Pub Design System/`.

## Stack

- **Next.js 16 (App Router) + TypeScript**, `src/` directory, ESLint. No
  Tailwind — all styling comes from the RPM Pub Design System's CSS custom
  properties (`src/styles/**`, imported globally in `src/app/globals.css`).
  The app is dark-only, matching the design system.
- **Postgres + Drizzle ORM**, parameterized queries only. Two interchangeable
  runtime drivers behind one `src/db/index.ts` client (see "Database" below).
- **Better Auth** (email+password, Drizzle adapter) for admin session auth.
- **Zod** for validation at every service-boundary input.
- **sharp** for image processing (image-pipeline unit), **qrcode** for the QR
  generator (M3 settings unit), **@modelcontextprotocol/sdk** for the MCP
  server (M3), **vitest** for unit tests.
- No Redis, no queues, no websockets (Phase 1 scope per PRD §5).

## Folder conventions

```
src/db/schema/**          Single Drizzle schema (PRD §5.1 + addendum §1-2).
                          Owned exclusively by foundation. Feature units
                          never edit these files — schema changes route
                          back through foundation.
src/db/index.ts           The one Drizzle client. Driver chosen by env.
src/db/migrate.ts          npm run db:migrate — applies drizzle-kit SQL
                          migrations against whichever driver is active.
src/db/reset.ts           npm run db:reset — dev-only schema wipe.
drizzle/migrations/**      drizzle-kit generate output (npm run db:generate).

src/lib/service/base/**   Mandatory service-layer wrapper: withAudit +
                          bumpAffectedScreens (see "Service layer" below).
src/lib/service/**        One file per domain (items.ts, screens.ts, ...).
                          Every mutation is a named (actor, input) -> result
                          function. Admin UI route handlers, REST API
                          handlers, and MCP tool handlers are thin wrappers
                          around these — never parallel logic.
src/lib/validation/**     Zod schemas per domain — the single validation
                          source of truth, imported by service + REST/MCP.
src/lib/auth/**           Better Auth config, session helper (server-only),
                          role-guard (requireOwner/requireStaffOrOwner).
src/lib/storage/**        StorageProvider interface (foundation). Concrete
                          drivers (local-disk, R2) are built by the
                          image-pipeline unit against this interface.
src/lib/rate-limit/**     Postgres sliding-window rate limiter.
src/lib/api-keys/hash.ts  API key generate/hash/verify primitive.

src/components/ds/**      Typed TSX ports of RPM Pub Design System
                          components/{core,menu}/*.jsx, faithful to their
                          .d.ts contracts. Import from "@/components/ds".
src/components/nav/**     The pre-registered admin rail-nav shell
                          (admin-nav.ts item list + AdminRail.tsx). Feature
                          units add pages under src/app/admin/**/page.tsx;
                          they never edit the shell or the nav item list.

src/app/admin/**          Admin UI. layout.tsx (shell + session gate) is
                          foundation-owned; each subdirectory's page.tsx is
                          a placeholder until its owning feature unit lands
                          (see each page's header comment for which unit).
src/app/login/**          Public sign-in page.
src/app/api/auth/**       Better Auth's route handler mount.
src/middleware.ts         Cheap cookie-presence redirect for /admin/** (real
                          session+role verification happens in
                          admin/layout.tsx via src/lib/auth/session.ts).

scripts/seed/**           `npm run db:seed` — venue_settings singleton +
                          first owner account only. Importing the real menu
                          is the onboarding-seed-and-runbook unit's job (M3).
```

## Database

`src/db/index.ts` exports a single Drizzle client, chosen at runtime:

- **`DATABASE_URL` set** (and `DB_DRIVER` unset/not `"pglite"`) → real
  Postgres via the `pg` driver. `docker-compose.yml` runs `postgres:16` on
  host port **55432** (not 5432, to avoid colliding with other local
  Postgres instances) — `docker compose up -d`.
- **No `DATABASE_URL`, or `DB_DRIVER=pglite`** → `@electric-sql/pglite`, an
  in-process Postgres-compatible engine. Data persists under
  `PGLITE_DATA_DIR` (default `.data/pglite`, gitignored). No Docker required.

Both paths run the exact same drizzle-kit-generated SQL migrations
(`drizzle/migrations/**`) because PGlite speaks the Postgres wire/SQL
dialect — jsonb, integer arrays, partial unique indexes, and CHECK
constraints all round-tripped cleanly in testing.

`Database` is typed as the concrete `NodePgDatabase<typeof schema>` shape
(not a union with `PgliteDatabase`) — TypeScript's overload resolution on
chained builder calls (e.g. `.insert(...).returning({...})`) collapses to
the least-common-denominator overload across a union type, which breaks
typed `.returning({...})` calls. The PGlite instance is cast to `Database`
at construction; this is safe because no call site touches driver-specific
internals.

**Known caveat:** PGlite is single-process/single-writer. Next.js's
production build (`next build`) collects page data using multiple worker
processes; if several workers each construct their own PGlite client
against the same `PGLITE_DATA_DIR` concurrently, you may see harmless
`TypeError` noise in the build log. The build still completes successfully
and the resulting route manifest is correct (verified). Prefer a real
Postgres (`DATABASE_URL`) for CI/build verification when possible; use
PGlite for fast local iteration (`next dev`).

**Sandboxed-environment note:** this scaffold was verified against the
PGlite path. `docker compose up -d` could not be exercised in the build
sandbox because `docker pull` hung on the host's `docker-credential-desktop`
helper (a sandboxing limitation, not a bug in `docker-compose.yml`). Confirm
`docker compose up -d` + `DATABASE_URL=postgres://postgres:postgres@localhost:55432/rpm_menu`
on a normal dev machine before relying on it.

## Service layer

Every mutating service function should:

1. Zod-validate its input (`src/lib/validation/<domain>.ts`).
2. Enforce role/scope via `src/lib/auth/role-guard.ts`
   (`requireOwner` / `requireStaffOrOwner`).
3. Write via parameterized Drizzle queries.
4. Call `withAudit` (`src/lib/service/base/audit.ts`) around the write, so
   `audit_log` gets a row with `before`/`after` JSON, actor, and surface —
   automatically, without each unit re-implementing audit writes.
5. Call `bumpAffectedScreens` (`src/lib/service/base/bump-affected-screens.ts`)
   with whichever `itemIds`/`categoryIds`/`tagIds`/`screenIds` the mutation
   touched, so `screens.version` bumps and `/menu` revalidates — the single
   shared side effect from PRD §5.3. Never invent a local "bump version"
   query-mode screens whose `source_config` references the changed
   tags/categories, and manual-mode screens listing the changed items via
   `screen_items`.

**Actor attribution convention:** `audit_log.actor_type` is a fixed 3-value
enum (`user` | `display` | `system`) per PRD §4.2 — it does not have an
`api_key` value. REST API and MCP-driven mutations should attribute with
`actor.type = "system"`, `actor.id = <api_keys row id>`, and
`surface = "api"` or `"mcp"` respectively, so audit rows stay attributable
without growing the actor-type registry.

## Design system integration

The design system ships React components as `.jsx` + `.d.ts` pairs meant to
be compiled to a browser global for its static `ui_kit` HTML demos — not a
pattern suited to Next.js App Router. Foundation resolved this by porting
each of the 10 components (`components/core/*`, `components/menu/*`)
directly to typed TSX under `src/components/ds/**`, faithful to the `.jsx`
source and `.d.ts` contract, importable as normal React components:

```tsx
import { Button, Card, MenuItem } from "@/components/ds";
```

Two intentional deviations from the literal `.d.ts` contracts:

- `MenuItemProps.price` is `number | string | undefined` (not required) —
  the addendum's ambiguous-pricing fail-safe requires that no price render
  at all for `pricing_mode = "ambiguous"`; the shared display-line helper
  (owned by items-categories-tags, `src/lib/menu/display-line.ts`) must be
  able to omit `price` entirely rather than being forced to pass a value.
- The `Tag` component's tone enum (`default | new | spicy | veggie | fave`)
  has no gluten-free/non-alcoholic tone — a design gap the addendum already
  flags. Until the design system adds one, use `tone="default"` for those
  labels rather than inventing an off-token color.

Tokens (`RPM Pub Design System/tokens/*.css`) and `styles.css` are copied
verbatim into `src/styles/**` and imported once, globally, from
`src/app/globals.css`. Never hardcode a color/space/radius a token already
covers — always `var(--...)`.

## Admin shell / nav

`src/components/nav/admin-nav.ts` is the complete, pre-registered rail-nav
item list (Items, Screens, Displays, Schedule, Audit Log, Bulk Ops,
Settings, API Keys). `src/app/admin/layout.tsx` + `AdminRail.tsx` render the
shared shell and gate access via `getCurrentSession()`. Feature units add
their real page content under `src/app/admin/**/page.tsx` (each current
placeholder's header comment says which unit owns it) — they never edit the
nav list or the shell layout itself. Settings tabs additionally have an
index page at `/admin/settings` linking to each tab.

One nav entry, **Schedule**, does not yet have a canonical owns_path in the
build plan — the weekly display-schedule editor is currently described as
living inside the Displays settings tab. `/admin/schedule` is a placeholder
route with no assigned owner; flagged for the orchestrator to either point
elsewhere or claim directly.

## Auth

Better Auth (`src/lib/auth/config.ts`) with the Drizzle adapter, reusing the
PRD's `users` table as Better Auth's "user" model (extended with
`emailVerified`/`image`/`updatedAt` for Better Auth's core requirements, and
`role`/`isActive` as additional fields). Two adapter quirks discovered
during integration, now fixed in config:

- `usePlural: true` — our tables are named `users`/`sessions`/`accounts`/
  `verifications` (plural), not Better Auth's singular defaults.
- `advanced.database.generateId: "uuid"` — every id column in the schema is
  `uuid`; Better Auth defaults to its own nanoid-style string ids, which
  fail Postgres's `uuid` type check on insert.

No self-signup (`emailAndPassword.disableSignUp: true`) — the first owner
account is created directly via `npm run db:seed` (bypassing the disabled
sign-up route entirely, using `better-auth/crypto`'s `hashPassword` to
insert the `users`/`accounts` rows the same way Better Auth's own sign-up
handler would). Subsequent staff accounts are an owner-invite flow owned by
the settings-venue-users unit.

`middleware.ts` only does a cheap `getSessionCookie` presence check (edge-
safe, no DB hit) to redirect anonymous visitors away from `/admin/**`. Real
session verification — including the `isActive` deactivation check, which
must take effect immediately per PRD §3.8 — happens server-side in
`admin/layout.tsx` via `src/lib/auth/session.ts`.

**Known deprecation warning:** Next.js 16 deprecates the `middleware.ts`
file convention in favor of a renamed `proxy.ts` convention (same shape,
different filename/export). `middleware.ts` still works fully (verified:
build succeeds, `/admin` correctly redirects to `/login`); the rename was
left for a later pass since the replacement convention is very new and
wasn't independently verified end-to-end under this deadline.

## Running locally

```bash
cp .env.example .env        # fill in BETTER_AUTH_SECRET, SEED_OWNER_*, etc.

# Database — pick one:
docker compose up -d        # Postgres 16 on localhost:55432
# ...or just leave DATABASE_URL unset / DB_DRIVER=pglite for the no-Docker
# PGlite fallback (already the .env.example default).

npm install
npm run db:migrate
npm run db:seed             # creates the first owner from SEED_OWNER_EMAIL/PASSWORD
npm run dev                 # http://localhost:3000
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run build`, `npm run db:generate` (after schema changes, foundation
only), `npm run db:reset` (dev-only: drops + recreates the public schema).
