# Demo Script: Claude 86ing an Item Live, via MCP

The PRD §9 M3 closing deliverable: "demo: Claude connected via MCP 86ing an
item live on the TV." This is that script — setup checklist, the exact MCP
connector config, and word-for-word prompts to run live.

> **Before you run this live, read this callout.** This unit's job was
> seeding the real menu + writing this script; the MCP server itself
> (`src/mcp/**`) is a sibling M3 unit, built in parallel — landed by the time
> this doc was finished, so the config below reflects its actual shape, not
> a guess:
>
> - **It's a local stdio process, not an HTTP endpoint.** `npm run mcp`
>   (`src/mcp/index.ts`) launches a long-lived MCP server over stdio,
>   authenticating once at startup against an `MCP_API_KEY` env var — there
>   is no per-request bearer header and no `/api/mcp` route to point a
>   remote connector at. Claude Desktop's config below uses a `command`
>   entry, not a `url` entry.
> - **The MCP server must point at the same database the live app (and the
>   paired TV) is reading from.** It reuses `src/db/index.ts`'s exact
>   `DATABASE_URL`/`DB_DRIVER` selection — set the same values in its env
>   block that the running app is using, or Claude's changes won't show up
>   anywhere the audience can see them.
> - **A real, confirmed gap this unit found while auditing the search path**:
>   `search_items`'s MCP tool (`src/mcp/tools/items.ts`) calls the exact same
>   `filterAndPageItems` helper the REST API uses
>   (`src/app/api/v1/_lib/items-query.ts`), which matches only
>   `name`/`description` substrings — it does **not** search the `aliases`
>   array this unit populated. Searching "reuben" or "corndog" still works
>   today only because those words happen to already be literal substrings
>   of the printed names ("Monster **Reuben**", "Foot Long **Corndog**s") —
>   same for "Coors" inside "**Coors** Light", which is why the flagship demo
>   line below still works. But a *true* alias search (something that is
>   **not** a substring of the name) will silently return nothing until
>   `filterAndPageItems`'s `haystack` also includes
>   `item.aliases.join(" ")`. **Rehearse this exact script once
>   end-to-end before the live demo**, and if it's not wired in yet by
>   showtime, stick to names/words that already appear in the printed item
>   name (as the script below does).

## What the audience will see

1. You (or the bartender) tell Claude, in plain English, that you're out of
   a beer.
2. Claude looks up the item, confirms with you, and flips it unavailable —
   no admin dashboard, no clicking around.
3. Within ~20–30 seconds (the TV's poll interval), the paired screen in the
   room visibly updates to show that item hidden or 86-badged (per the
   venue's unavailable-item display setting, §3.8) — live, on the same TV
   the audience is looking at.

No custom bot, no chat UI, no adapter — this is Claude Desktop talking
directly to the same MCP server a Slack/Discord bot would use in Phase 2,
over the same tool surface, on Phase 1's first day.

## Pre-demo setup (do this before the audience arrives)

### 1. Have the app running against a real database

Start the app (`npm run dev` or however it's deployed) against whichever
database it'll use for the demo — Postgres via Docker
(`docker compose up -d` + `DATABASE_URL=postgres://postgres:postgres@localhost:55432/rpm_menu`)
is the more convincing choice for a live demo than the PGlite fallback,
since it's the same kind of database a real deployment would use. Make sure
the real menu is seeded (`npm run db:seed`) and at least one TV is paired
and showing a screen (`docs/runbook-fire-stick.md`).

If this database was already seeded *before* this unit's aliases work
landed, its items will have empty `aliases` arrays (seeding only runs once
— `npm run db:seed` no-ops if `items` already has rows). Run
`npm run db:reset && npm run db:seed` to pick up the new aliases before the
demo if in doubt — check with
`select name, aliases from items where name = 'Coors Light';` first if
you're not sure (should show `{Coors}`, not `{}`).

The MCP server (next section) is a **separate local process** that talks to
this same database directly — it is not the same thing as the running app,
and it does not proxy through it. Since it's a local stdio process (see
callout above), there's no tunnel/networking step needed even for a fully
local demo — Claude Desktop launches it as a subprocess on your own machine.

### 2. Create a scoped API key

Log in as an owner → **Settings → API Keys → Create key**:

- **Name**: `Claude Demo`
- **Scopes**: `read` and `write:availability` only. Per PRD §3.7's security
  posture — "an AI client is just another authenticated actor with the
  narrowest scopes that work" — an availability-toggle demo needs neither
  `write:items`, `write:prices`, nor `write:screens`. Don't grant them.
- Copy the plaintext key shown — **it's shown exactly once.**

### 3. Pick (and pre-check) the demo item

- Use **Coors Light** (Cans category) — it already carries the search alias
  `"Coors"` (`scripts/seed/aliases.ts`), which lines up with the PRD's own
  example line: *"we're out of Coors."*
- Confirm it's currently **available** before the demo starts, so the
  "before" state on the TV reads clearly (if it's already 86'd from a prior
  rehearsal, flip it back on first).
- Make sure a paired TV (`docs/runbook-fire-stick.md`) is showing a screen
  that actually includes Coors Light, ideally screen-shared or in the same
  room as the audience.

### 4. Configure the MCP connection

The server is a local process (`npm run mcp`, i.e. `tsx --env-file=.env
src/mcp/index.ts`) that authenticates once at startup off an `MCP_API_KEY`
env var — Claude Desktop launches it as a subprocess, so this is a
`command`-style entry, not a `url` one. Edit `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`;
Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rpm-menu": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/rpm-menu",
      "env": {
        "MCP_API_KEY": "<PASTE_YOUR_API_KEY_HERE>",
        "DATABASE_URL": "postgres://postgres:postgres@localhost:55432/rpm_menu"
      }
    }
  }
}
```

Notes on this config:

- `cwd` must be the absolute path to this repo on the machine running Claude
  Desktop — the MCP process needs to run from there to resolve its own
  `tsx`/module paths.
- `DATABASE_URL` (and, if using the PGlite fallback instead of Docker
  Postgres, `DB_DRIVER=pglite` + `PGLITE_DATA_DIR`) **must match whatever
  the running app itself is using** — this is what makes Claude's changes
  show up on the paired TV; if they point at different databases, the demo
  will look broken (Claude will report success, nothing will happen on
  screen) even though nothing is actually wrong.
- Don't put a real API key in a file that gets committed — this config
  lives in Claude Desktop's own local config directory, not in the repo.

Save, then fully quit and reopen Claude Desktop so it picks up the new
server. Confirm it connected: the tools/connector icon in a new chat should
list an **rpm-menu** MCP server with tools including `search_items`,
`set_availability`, `update_item`, `list_86d`, plus the screens/audit/
pending-changes tools (`get_screen`, `update_screen`, `get_recent_changes`,
`preview_price_adjustment`, `apply_pending_change` — PRD §3.7's full tool
list). If it fails to connect, check Claude Desktop's MCP logs first — a
bad `MCP_API_KEY` or unreachable `DATABASE_URL` fails loudly at startup with
an actionable message (`src/mcp/auth.ts`), not a silent hang.

claude.ai's browser-based Connectors UI is not a fit for this server as
built — it expects a reachable HTTP endpoint for remote connectors, and this
MCP server only speaks stdio. Use Claude Desktop for this demo.

## The live script

Run these prompts in order, in a fresh chat with the rpm-menu connector
active.

### Beat 1 — the headline demo: 86 an item by voice/text alone

> **You type:** "We're out of Coors — can you 86 it on the menu?"

**What should happen:** Claude calls `search_items` (query "Coors"),
resolves it to **Coors Light**, calls `set_availability` with
`isAvailable: false` — a single-step tool per PRD §3.7 ("single-item
availability toggles execute in one step, matching the product's trust
model") — and narrates back exactly what it changed (item name, new
availability state).

**What the audience should watch for:** within ~20–30 seconds, the paired TV
re-renders with Coors Light gone (or badged 86'd, per the venue's display
setting) — with nobody having touched a keyboard, admin page, or remote.

### Beat 2 — bring it back (shows the toggle is reversible, one click either way)

> **You type:** "Actually, bring Coors Light back — we got a delivery."

**What should happen:** another single-step `set_availability` call,
`isAvailable: true`. TV flips back within the same ~20–30 second window.

### Beat 3 (optional, if there's time) — the two-step confirm flow for anything riskier

> **You type:** "Raise all our draft beer prices by 50 cents."

**What should happen, and why it's the interesting part:** unlike Beat 1/2,
this is bulk + price, so per PRD §3.7's binding tool-design rule, Claude
*cannot* apply this in one step even if asked to — it must call
`preview_price_adjustment` first, which creates a `pending_changes` row and
returns the full diff (which items, old price → new price). Claude should
narrate the diff and explicitly ask you to confirm before doing anything
else. Only after you say something like "yes, apply it" does it call
`apply_pending_change(<the id preview just returned>)` — the apply tool
**only accepts a server-issued id**, so Claude has no way to skip the
preview step even under a more insistent prompt. This is the part worth
narrating to the audience: *the two-step confirmation is enforced by the
tool surface itself, not by Claude choosing to be careful.*

Note per addendum §5's owner decision: this only touches `items.price_cents`
— it will not move modifier-option deltas or happy-hour variant prices, and
a good follow-up line for Claude to narrate ("this doesn't touch add-on
pricing") shows the tool being honest about its own scope.

### Beat 4 (optional) — attribution / audit trail

> **You type:** "What menu changes have happened today?"

**What should happen:** Claude calls `get_recent_changes` and lists the
availability toggles (and price change, if Beat 3 ran) from this session,
each attributed to the `Claude Demo` API key — the same audit log every
admin-UI edit writes to (`src/lib/service/base/audit.ts`), filterable from
**Settings → Audit Log** afterward. This is the moment to point out that an
AI client is "just another authenticated actor," not a special back door —
same audit trail, same one-click revert available from the admin UI if
anything needs undoing.

## Troubleshooting during the demo

- **Claude says it can't find "Coors"**: fall back to the item's literal
  printed name — "86 Coors Light" — while someone checks whether
  `aliases` is wired into the search filter yet (see the callout at the top
  of this doc).
- **TV doesn't update after ~30s**: check **Settings → Audit Log** — if the
  change is there, the screen's poll just hasn't landed yet (wait a bit
  longer, or check the TV's wifi/offline indicator per
  `docs/runbook-fire-stick.md`); if the change is *not* there, the tool call
  itself failed — check Claude's own error message first (likely a scope or
  auth issue with the API key).
- **Claude tries to apply a bulk/price change in one step**: that would be a
  bug in the MCP server, not expected behavior — the two-step rule is a
  server-side guarantee (the apply tool structurally cannot accept anything
  but a real pending-change id), not something Claude decides to honor.
