# MCP Server

The M3 programmatic management surface (PRD §3.7) exposed as an
[MCP](https://modelcontextprotocol.io) stdio server, built on the preinstalled
`@modelcontextprotocol/sdk`. It is the second of two layers over the same
`src/lib/service/**` functions the admin UI and REST API (`/api/v1/**`) call —
every tool below is a thin wrapper around an existing service call, never
parallel logic. Connect Claude Desktop, Claude Code, or any other MCP client
directly to this server and it can search the menu, 86 an item, adjust
prices (with a mandatory preview step), and read the audit log — the "we're
out of Coors" demo from day one, no bot or chat adapter required.

## How auth works

Unlike the REST API (one `Authorization: Bearer <key>` header per HTTP
request), an MCP stdio connection is long-lived and has no per-request
headers. So this server authenticates **once, at process startup**, against
an API key passed in the `MCP_API_KEY` environment variable:

1. Look up `MCP_API_KEY`'s SHA-256 hash in the `api_keys` table (same table,
   same hashing primitive — `src/lib/api-keys/hash.ts` — the REST API and the
   admin UI's Settings > API Keys tab use). Refuses to start if the key is
   missing from the environment, unknown, or revoked.
2. Derive the connected key's granted scopes straight off that row.
3. Build a `ServiceCaller` with `actor: { type: "system", id: <api_keys row
   id> }, surface: "mcp"` — every mutation this connection makes is
   attributed in `audit_log` to that key, distinguishable from REST API calls
   (`surface: "api"`) and admin UI actions (`surface: "admin_ui"`) even
   though both API keys and MCP share the same `system` actor type.

Every tool call after that is checked against the scopes resolved in step 2
(see the table below) and against a per-key rate limit (120 calls / 60s,
mirroring the REST surface's default) — a confused or adversarial AI client
is bounded by scopes + rate limit + the two-step preview/apply flow, exactly
like every other authenticated actor per §3.7's security posture. **No
settings-write scope exists in Phase 1** (§3.8) — nothing here can ever
change timezone, users, or branding, no matter what scopes a key is granted.

Create a key from the admin UI's **Settings > API Keys** tab (name + scope
checkboxes; the secret is shown once, hashed at rest from then on). Grant it
only the scopes the connecting AI client actually needs — `read` alone is
enough for a "what's on the menu / what's 86'd" assistant; add
`write:availability` for 86-toggling; `write:items`/`write:prices` /
`write:screens` only if that client should actually be allowed to edit.

## Two-step confirmation for bulk/price/destructive tools

Per §3.7's binding tool-design rule: `preview_price_adjustment` writes
nothing to `items` — it validates the request, computes an old/new diff per
item, and stashes `{input, diff}` in a new `pending_changes` row that expires
in **15 minutes**, returning that row's id plus the diff. `apply_pending_change`
is the only way to actually commit it, and it **only ever accepts a
server-issued `pendingChangeId`** — there is no way to construct or guess a
valid one, and `apply_pending_change` re-validates freshness (rejecting an
expired, already-applied, or cancelled id) before writing anything. An AI
client physically cannot skip the preview.

`set_availability` (the 86/un-86 toggle) is deliberately **one-step** —
single-item availability toggles execute immediately, matching the product's
trust model (§3.7: "Single-item availability toggles execute in one step").

## Connecting a client

### Claude Desktop

Add to Claude Desktop's MCP config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rpm-menu": {
      "command": "npm",
      "args": ["run", "mcp", "--prefix", "/absolute/path/to/rpm-menu"],
      "env": {
        "MCP_API_KEY": "rpm_...",
        "DATABASE_URL": "postgres://postgres:postgres@localhost:55432/rpm_menu"
      }
    }
  }
}
```

Omit `DATABASE_URL` (or set `DB_DRIVER=pglite`) to run against the no-Docker
PGlite fallback instead — same driver-selection rule `src/db/index.ts` uses
for the Next.js app itself, so this server can point at whichever database
your `npm run dev` is currently using.

### Claude Code

```bash
claude mcp add rpm-menu \
  --env MCP_API_KEY=rpm_... \
  --env DATABASE_URL=postgres://postgres:postgres@localhost:55432/rpm_menu \
  -- npm run mcp --prefix /absolute/path/to/rpm-menu
```

### Any other MCP client

Launch `npm run mcp` (equivalently `tsx --env-file=.env src/mcp/index.ts`)
with `MCP_API_KEY` set in the environment (or in `.env`, alongside
`DATABASE_URL`/`DB_DRIVER`/`PGLITE_DATA_DIR` — the same variables
`docs/architecture.md`'s "Running locally" section documents) and connect
over stdio.

## PGlite single-writer note

PGlite (the no-Docker dev database) has no built-in cross-process locking —
two Node processes can open the very same on-disk data directory
concurrently with no error from either side, which is exactly the failure
mode `docs/architecture.md`'s "Known caveat" describes for concurrent
`next build` workers. This server does not rely on PGlite to protect itself:
it acquires its own advisory lock file (`<PGLITE_DATA_DIR>/.mcp-server.lock`,
PID + timestamp, atomic create) before ever opening the database, and
**refuses to start with a clear error** if a live process already holds it —
a stale lock left by a crashed process is detected (dead PID) and reclaimed
automatically. This guards against two MCP server instances racing each
other; it cannot see a concurrently running `next dev`/`db:migrate`/`db:seed`
process, since those entry points don't participate in this lock convention.
Per the sandboxing rule already in force for this repo: **never** run this
MCP server against the same `PGLITE_DATA_DIR` a `next dev`/`db:*` process is
using, and vice versa. Point the server at a real Postgres (`DATABASE_URL`,
e.g. the `docker-compose.yml` instance on port 55432) instead if you need it
running alongside the dev server.

## Tools

Every tool's input is Zod-validated by the MCP SDK before its handler ever
runs; the handler then calls straight into the same service function the
REST route for that operation calls. No tool accepts raw SQL, an unbounded
bulk selector, or an arbitrary confirmation id.

| Tool | What it does | Required scope(s) | Step(s) | Service function called |
|---|---|---|---|---|
| `search_items` | Search/list items by name/description text, category, tag, availability, pricing type | `read` | 1 | `listItems` (+ `filterAndPageItems`) |
| `set_availability` | Toggle one item's availability (the "86 it" action) | `write:availability` | 1 | `setItemAvailability` |
| `update_item` | Update one item's fields; price fields need an extra scope | `write:items` (+ `write:prices` if the call sets `priceCents`/`pricingType`) | 1 | `updateItem` |
| `preview_price_adjustment` | Dry-run a flat-cents or percent price change across a set of items | `write:prices` | 1 of 2 (preview) | `previewBulkOperation` (`changeType: "bulk_price_adjust"`) |
| `apply_pending_change` | Commit a previously previewed change by its server-issued id | scope depends on the previewed change's type (checked after loading it — `write:prices` for a price adjustment) | 2 of 2 (apply) | `applyBulkOperation` |
| `list_86d` | List every currently-unavailable item, optionally filtered by text/category | `read` | 1 | `listItems` (+ `filterAndPageItems`, `isAvailable: false` hardcoded) |
| `get_screen` | Read one display screen's full configuration | `read` | 1 | `getScreen` |
| `update_screen` | Update a screen's name/template/source config/display options | `write:screens` | 1 | `updateScreen` |
| `get_recent_changes` | Read the audit log / "recent changes" feed, filterable by actor/entity type | `read` | 1 | `listRecentChanges` |

Every tool result is a single text content block containing pretty-printed
JSON of the underlying service call's return value (e.g. `{ "item": {...} }`,
`{ "preview": { "pendingChangeId": "...", "diff": [...] } }`) — structured
enough for any AI client to parse and narrate accurately, per §3.7's "Tools
return structured results including what changed."

## Source layout

```
src/mcp/
  index.ts            Entrypoint (`npm run mcp`) -- builds the DB client,
                       authenticates MCP_API_KEY, registers tools, connects
                       the stdio transport. All diagnostics go to stderr;
                       stdout is the JSON-RPC channel.
  server.ts            Builds the McpServer instance + registers tools.
  auth.ts              Startup MCP_API_KEY -> api_keys row -> ServiceCaller.
  db.ts                 DB client construction (mirrors src/db/index.ts's
                       driver selection) with the PGlite lock check wired
                       in ahead of ever opening the database.
  pglite-lock.ts        The PGlite single-writer advisory lock.
  rate-limit.ts         Per-key rate limiting for tool calls.
  tool-helpers.ts        Shared McpToolContext, scope assertion, and the
                       rate-limit + JSON-result wrapper every tool uses.
  tools/
    schemas.ts           Zod input shapes for all 9 tools.
    items.ts             search_items, set_availability, update_item, list_86d
    pending-changes.ts    preview_price_adjustment, apply_pending_change
    screens.ts            get_screen, update_screen
    audit.ts              get_recent_changes
    index.ts              Registers all 9 tools onto an McpServer.
```
