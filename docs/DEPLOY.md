# Deploy: Railway (Postgres) + Vercel (app)

This is the step-by-step for deploying the RPM Menu CMS to **Vercel** (the
Next.js app) with **Railway** hosting the **Postgres** database and **Vercel
Blob** hosting uploaded food photos. Following it end-to-end reproduces the
entire demo — the full menu **and** every food photo — on fresh
infrastructure, because both come up from `npm run db:seed` (see
[Reproducibility](#reproducibility)).

> **Migrations are NOT auto-run by Vercel.** Vercel only runs `next build`.
> You must run `npm run db:migrate` (and `npm run db:seed`) against the
> Railway database yourself — see step 5. If you skip this, the app deploys
> but every query hits missing tables.

## Architecture recap

| Concern            | Local dev                         | Production                                  |
| ------------------ | --------------------------------- | ------------------------------------------- |
| App runtime        | `next dev` on :3000               | Vercel (Next.js 16, auto-detected)          |
| Database           | Docker Postgres :55432 or PGlite  | Railway Postgres (`DATABASE_URL`)           |
| Image storage      | local-disk (`.uploads/`)          | Vercel Blob (`STORAGE_DRIVER=blob`)         |
| Migrations         | `npm run db:migrate`              | `npm run db:migrate` against Railway (manual) |
| Menu + photo seed  | `npm run db:seed`                 | `npm run db:seed` against Railway (manual)    |

Why Vercel Blob and not local-disk in prod: Vercel's serverless/edge
filesystem is **ephemeral** — anything the local-disk driver writes to
`.uploads/` disappears on the next deploy or scale event. The Blob driver
(`src/lib/storage/vercel-blob-driver.ts`) stores each processed image variant
in a durable object store and persists the Blob's own public https URL.

---

## Prerequisites

- A [Railway](https://railway.app) account.
- A [Vercel](https://vercel.com) account, with this GitHub repo
  (`ghyde3/rpm-menu`) pushed.
- Local checkout with `npm install` run (you'll run `db:migrate`/`db:seed`
  from your machine, pointed at the Railway database).
- Optionally the [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
  and [Railway CLI](https://docs.railway.app/develop/cli).

---

## Step 1 — Provision Railway Postgres

1. In the Railway dashboard: **New Project → Provision PostgreSQL** (or, in an
   existing project, **New → Database → Add PostgreSQL**).
2. Open the Postgres service → **Variables** (or **Connect**) tab and copy the
   **`DATABASE_URL`** (the public/proxy connection string, form
   `postgresql://postgres:<password>@<host>.proxy.rlwy.net:<port>/railway`).
   Use the **public** URL — your local machine and Vercel both connect from
   outside Railway's private network.
3. Keep this value handy; it's the `DATABASE_URL` for both the migration step
   and the Vercel env vars. **Leave `DB_DRIVER` unset** in production — setting
   it to `pglite` would ignore `DATABASE_URL` and fall back to the local
   in-process engine.

## Step 2 — Create a Vercel Blob store + token

1. In the Vercel dashboard: **Storage → Create → Blob**, name it (e.g.
   `rpm-menu-media`), and create it. (CLI equivalent: `vercel blob store add
   rpm-menu-media`.)
2. Copy the store's **`BLOB_READ_WRITE_TOKEN`** (`vercel_blob_rw_...`). When
   you connect the store to the project (step 3), Vercel can inject this
   automatically, but you also need it locally for the seed step, so copy it.

## Step 3 — Connect the GitHub repo to Vercel

1. **Add New… → Project** → import `ghyde3/rpm-menu` from GitHub.
2. Framework preset auto-detects **Next.js** (confirmed by the committed
   `vercel.json`: `framework: nextjs`, `buildCommand: next build`,
   `installCommand: npm install`). Leave the defaults.
3. **Do not deploy yet** — set env vars first (step 4). If Vercel deploys on
   import, that first build is fine (it compiles), but the app won't work
   until env vars are set and migrations have run.

## Step 4 — Set environment variables in Vercel

Project → **Settings → Environment Variables**. Add each of these for the
**Production** environment (and Preview if you want preview deploys to work):

| Variable                | Value                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`          | Railway Postgres URL from step 1                             |
| `BETTER_AUTH_SECRET`    | 32+ byte random secret — `openssl rand -base64 32`           |
| `BETTER_AUTH_URL`       | the app's production URL, e.g. `https://rpm-menu.vercel.app` |
| `NEXT_PUBLIC_APP_URL`   | same production URL as `BETTER_AUTH_URL`                      |
| `STORAGE_DRIVER`        | `blob`                                                        |
| `BLOB_READ_WRITE_TOKEN` | the Blob store token from step 2                             |
| `SEED_OWNER_EMAIL`      | first owner login email                                      |
| `SEED_OWNER_PASSWORD`   | first owner login password (≥ 8 chars)                       |

Notes:

- **Do not set `DB_DRIVER`** (leave it unset → the real `pg` driver is used).
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`: you may not know the final
  `*.vercel.app` domain until after the first deploy. Set them to your
  intended production domain (custom domain if you have one); if you use the
  auto-assigned domain, set them once it's known and redeploy so absolute
  links / QR codes / auth callbacks resolve correctly.
- If you connected the Blob store to the project in step 2, Vercel may have
  already added `BLOB_READ_WRITE_TOKEN` — don't duplicate it.

## Step 5 — Run migrations + seed against Railway (from your machine)

Vercel does **not** run these. Do it once, locally, pointed at Railway. Set
`STORAGE_DRIVER=blob` + the Blob token so the seed uploads photos to Blob
(exactly the pipeline production uses), and the Railway `DATABASE_URL`:

```bash
# From the repo root, with the Railway values substituted in.
# These are inline for the command only — do NOT commit them.
export DATABASE_URL='postgresql://postgres:...@...proxy.rlwy.net:PORT/railway'
export STORAGE_DRIVER=blob
export BLOB_READ_WRITE_TOKEN='vercel_blob_rw_...'
export BETTER_AUTH_SECRET='...'                 # same as Vercel
export SEED_OWNER_EMAIL='owner@rpmpub.com'
export SEED_OWNER_PASSWORD='a-strong-password'
# DB_DRIVER must stay UNSET so the pg driver targets Railway.

npx tsx src/db/migrate.ts     # apply drizzle migrations to Railway
npx tsx scripts/seed/index.ts # owner + venue + full menu + all food photos
```

`db:seed` runs `import-menu.ts` (the full menu from the extracted `.md`
files) then `import-photos.ts`, which reads the committed
`seed-assets/menu-photos/*.webp` and pushes each through the real
`uploadImage` → `addItemImage` pipeline. Because `STORAGE_DRIVER=blob`, every
photo is processed and uploaded to the Vercel Blob store, and its public URL
is written into `images.variants`. The seed prints its assertions:

```
Menu photos: 55 items attached (67 photos), 0 already had a gallery (skipped).
All photo-seed assertions passed:
  items with a hero image = 55 (>= 55)
  multi-photo gallery items (>= 3) = 6
```

> The npm scripts (`npm run db:migrate` / `npm run db:seed`) load `.env` via
> `--env-file=.env`. You can instead put the Railway/Blob values in a local
> `.env` and use those — but `.env` is gitignored; never commit it. The
> `npx tsx …` form above avoids touching `.env` entirely.
>
> **Idempotency:** re-running `db:seed` is safe — the menu import skips when
> items already exist and the photo import skips any item that already has a
> gallery. To rebuild from scratch, run `npx tsx src/db/reset.ts` first
> (⚠️ drops the whole schema — never against a database you want to keep).

## Step 6 — Deploy the app

1. Trigger a deploy: push to `main`, or in Vercel **Deployments → Redeploy**.
   Vercel runs `npm install` then `next build` and publishes.
2. If you set/changed `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` after the first
   deploy, redeploy so the new values are baked in.

## Step 7 — Verify

1. Visit `https://<app>.vercel.app/menu` — the public menu renders with items
   **and** food photos (photos load from
   `https://<store>.public.blob.vercel-storage.com/...` URLs).
2. Visit `/login`, sign in with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`.
3. In the admin UI, upload a new image on any item → it should succeed and the
   new photo should serve from a `*.public.blob.vercel-storage.com` URL
   (confirming the Blob driver is active in production, not local-disk).

---

## Reproducibility

The whole point of this setup: nothing about the demo is wired by hand.

- **Menu content** comes from `rpm-menu-extracted.md` / `rpm-drinks-extracted.md`,
  parsed and loaded by `scripts/seed/import-menu.ts`.
- **Food photos** are committed as `seed-assets/menu-photos/*.webp` (67 files,
  ~7.5 MB) with an ordered manifest `scripts/seed/menu-photos.json` mapping
  each item to its gallery (first file = hero/primary).
  `scripts/seed/import-photos.ts` re-uploads them through the real image
  pipeline against whichever `STORAGE_DRIVER` is active.

So `db:reset && db:migrate && db:seed` reproduces the **entire** demo on any
environment/driver — local-disk in dev, Vercel Blob in prod — with no manual
image wiring.

## Migration strategy (explicit)

- Migrations live in `drizzle/migrations/**` (generated by
  `npm run db:generate` after schema changes).
- **They are applied by `npm run db:migrate`, which is a manual step.** Vercel's
  build does not run them. Run migrate against the Railway `DATABASE_URL`
  before (or at) the first deploy, and again after any future schema change
  **before** deploying the code that depends on it.
- PGlite is a local-dev-only fallback; production always uses the Railway
  Postgres via `DATABASE_URL` with `DB_DRIVER` unset.

## What requires a human (secrets & dashboard actions)

These cannot be done from code / CI and must be performed by a person:

- Creating the Railway Postgres service and copying its `DATABASE_URL`
  (contains a secret password).
- Creating the Vercel Blob store and copying its `BLOB_READ_WRITE_TOKEN`.
- Generating `BETTER_AUTH_SECRET` and choosing `SEED_OWNER_PASSWORD`.
- Entering all of the above into Vercel's Environment Variables UI.
- Connecting the GitHub repo to Vercel and (optionally) attaching a custom
  domain — then updating `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` to match.
- Running the one-time `db:migrate` + `db:seed` against Railway.
