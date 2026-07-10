# Backups & Restore

PRD §3.6: "daily automated Postgres backups; restore procedure documented
and tested once." This document is that restore procedure — actually
exercised end-to-end against the project's `docker-compose.yml` Postgres 16
instance on 2026-07-09, commands and output below are real, not illustrative
— plus the recommended backup strategy around it.

## What actually needs backing up, and what doesn't

| Data | Where it lives | Covered by a Postgres backup? |
|---|---|---|
| Menu (items, categories, tags, modifiers, price variants) | Postgres | Yes |
| Screens, displays, schedules | Postgres | Yes |
| Users, sessions, API keys, audit log | Postgres | Yes |
| Venue settings | Postgres | Yes |
| **Uploaded images** (item/category photos, logo) | `StorageProvider` — local disk (`.uploads/`, dev) or R2 (prod) | **No** — back these up separately |

A Postgres backup alone does not capture uploaded image files. If
`STORAGE_DRIVER=local`, the `.uploads/` directory needs its own backup
(rsync/tar to off-box storage on the same schedule as the DB). If
`STORAGE_DRIVER=r2`, Cloudflare R2 already durably replicates objects — no
extra action needed there beyond making sure the bucket itself isn't
deleted, but note R2 has no automatic point-in-time "undo an accidental
delete" beyond whatever object-versioning/lifecycle rules you configure on
the bucket.

The admin UI's **Settings → Data & Recovery** tab (§3.8) also offers a
**one-click full JSON export** of menu/screens/settings
(`src/lib/service/settings/data-recovery.ts`'s `exportFullData`). That
export is a convenience/portability tool for the venue owner ("I want my
menu data if we ever switch systems") — it is **not** a backup mechanism:
it deliberately excludes `users`/`accounts`/`sessions`/`api_keys`/
`audit_log` (credentials and history, not "menu data"), and there is no
matching *import* path to restore it. The real backup/restore path is the
Postgres-level one below.

## Backup strategy (recommended)

Phase 1 has no hosted-production target wired up yet (the only environment
that exists today is `docker-compose.yml`'s local Postgres 16 on port
55432) — so this is the recommended pattern to adapt to wherever this
actually gets deployed, not a already-cron-scheduled job:

1. **Daily automated `pg_dump`**, custom format (`-F c`) so it can be
   restored selectively and in parallel, kept off the database host itself:

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
   pg_dump --format=custom --file="/backups/rpm_menu_${STAMP}.dump" "$DATABASE_URL"
   # Ship it somewhere that isn't the same disk/host as the database, e.g.:
   #   aws s3 cp "/backups/rpm_menu_${STAMP}.dump" "s3://<bucket>/pg-backups/"
   # Retention: keep 7 daily + 4 weekly + 3 monthly, prune the rest.
   date -u -Iseconds > /backups/.last-success  # feeds BACKUP_LAST_SUCCESS_AT below
   ```

   Run it via cron (self-hosted) or the equivalent scheduled-job primitive
   of whatever host ends up running this (Railway/Fly/a managed VM's
   crontab/etc). If the eventual production database is a managed Postgres
   provider (Neon, Railway, RDS, etc.) instead of self-hosted, prefer that
   provider's own automatic point-in-time backups over a hand-rolled
   `pg_dump` cron — but keep a `pg_dump` export in the rotation anyway as a
   portable, provider-independent copy.

2. **Wire `BACKUP_LAST_SUCCESS_AT`** so the admin UI's backup-status tile
   reflects reality instead of showing "not configured" forever.
   `getBackupStatus` (`src/lib/service/settings/data-recovery.ts`) reads
   this env var directly — no schema/heartbeat table exists for it (a
   documented, intentional gap left by the settings unit, since wiring an
   actual backup job was outside that unit's scope). Whatever runs the
   daily `pg_dump` job should set this env var to an ISO-8601 timestamp
   after each successful backup (see the last line of the script above),
   in whatever env-var mechanism the deploy target uses (a `.env` write, a
   platform's secret/env store, etc.) so the running app picks it up.

3. **Test the restore periodically**, not just once at launch — a backup
   nobody has restored from is a hypothesis, not a backup. Quarterly is a
   reasonable cadence for a venue this size. The exact procedure to repeat
   is below.

## Tested restore procedure

This is the actual sequence run against this project's `docker-compose.yml`
Postgres (port 55432) to validate the backup format round-trips cleanly,
including this unit's own seed data (101 real-menu items, aliases
populated, audit log, the owner account) — not a hypothetical.

### 0. Setup used for the test

An isolated scratch database (`rpm_menu_backup_demo`) inside the same
running `postgres:16` container was migrated and seeded via this repo's own
scripts, so the dump has real, representative content:

```bash
docker compose up -d   # postgres:16 on localhost:55432, if not already running

docker exec rpm-menu-postgres-1 psql -U postgres -c "CREATE DATABASE rpm_menu_backup_demo;"

DATABASE_URL="postgres://postgres:postgres@localhost:55432/rpm_menu_backup_demo" \
  npx tsx src/db/migrate.ts

DATABASE_URL="postgres://postgres:postgres@localhost:55432/rpm_menu_backup_demo" \
  SEED_OWNER_EMAIL="owner-backup-demo@example.com" \
  SEED_OWNER_PASSWORD="backup-demo-password-123" \
  npx tsx scripts/seed/index.ts
```

Output confirmed the full real-menu import succeeded, including this unit's
aliases work:

```
All hard assertions passed:
  total items = 101
  Wing Sauce Choice options = 12
  Included Side options = 12 (all linked to Sides items)
  ambiguous options with a non-null price = 0
  items with a populated aliases array = 51
Seed complete.
```

(A real production restore drill skips this step entirely — you'd be
dumping the actual live database, not a freshly-seeded scratch copy. This
step only exists here to generate realistic content to dump/restore against
in a sandboxed way, without touching the shared dev database.)

### 1. Take the backup

```bash
docker exec rpm-menu-postgres-1 \
  pg_dump -U postgres -d rpm_menu_backup_demo -F c -f /tmp/rpm_menu_backup_demo.dump

docker cp rpm-menu-postgres-1:/tmp/rpm_menu_backup_demo.dump ./rpm_menu_backup_demo.dump
```

Resulting dump file: **78,713 bytes**, custom-format (`-F c`), which is what
enables `pg_restore`'s selective/parallel restore options below.

### 2. Simulate the disaster: restore into a brand-new database

The whole point of the drill is proving you can go from *just the dump
file* to a working database — so restore into a database that has never
seen this data before, not back into the same one:

```bash
docker exec rpm-menu-postgres-1 psql -U postgres -c "CREATE DATABASE rpm_menu_restore_demo;"

# Copy the dump back onto the server if restoring from an off-box copy:
docker cp ./rpm_menu_backup_demo.dump rpm-menu-postgres-1:/tmp/rpm_menu_backup_demo.dump

docker exec rpm-menu-postgres-1 \
  pg_restore -U postgres -d rpm_menu_restore_demo /tmp/rpm_menu_backup_demo.dump
```

`pg_restore` exited 0, no errors.

### 3. Verify the restore actually matches

Row counts, before (original) vs. after (restored) — identical:

| Table | Original | Restored |
|---|---|---|
| `items` | 101 | 101 |
| `users` | 1 | 1 |
| `audit_log` | 243 | 243 |
| `items` with a non-empty `aliases` array | 51 | 51 |

And a spot check that the actual alias *values* (not just counts) survived
the round trip intact:

```
         name          |      aliases
-----------------------+--------------------
 Blackened Chicken BLT | {BLT}
 Coors Light           | {Coors}
 Foot Long Corndogs    | {Corndog,Corndogs}
 Monster Reuben        | {Reuben}
```

### 4. Clean up

```bash
docker exec rpm-menu-postgres-1 psql -U postgres -c "DROP DATABASE rpm_menu_backup_demo;"
docker exec rpm-menu-postgres-1 psql -U postgres -c "DROP DATABASE rpm_menu_restore_demo;"
docker exec rpm-menu-postgres-1 rm -f /tmp/rpm_menu_backup_demo.dump
```

The shared `rpm_menu` database (the one the rest of this build uses) was
never touched by this drill — verified its `items` count (101) was
unchanged before and after.

### Restoring in place (recovering the *original* database, not a copy)

The drill above restores into a fresh database name, which is the right way
to *validate* a backup without risking anything. For an actual outage where
the original database itself needs to come back:

```bash
# Terminate other connections first, or Postgres will refuse to drop/recreate:
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'rpm_menu';"

dropdb -U postgres rpm_menu
createdb -U postgres rpm_menu
pg_restore -U postgres -d rpm_menu /path/to/latest.dump
```

Or, without dropping the database at all, `pg_restore --clean --if-exists
-d rpm_menu /path/to/latest.dump` restores over the existing schema in
place (drops and recreates each object as it goes) — useful when you can't
drop the database itself (e.g. a managed-provider database you don't have
`DROP DATABASE` rights on).

After any real restore, run `npm run db:migrate` once more before bringing
the app back up, in case the backup predates a schema migration that's
landed since — `drizzle-kit`'s migrations are idempotent/tracked, so
re-running against an already-migrated database is a safe no-op.
