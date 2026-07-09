# PRD: Menu CMS + TV Display Platform
**Working name:** TBD
**Version:** 0.1 (Draft)
**Owner:** Gary Hyde
**Status:** Phase 1 scoped for build; Phase 2 specified for architectural readiness only

---

## 1. Overview

A single-tenant menu management platform for a bar/restaurant client. The owner and staff manage food and drink menu content through a simple admin UI. Menu content renders to (a) a public web menu and (b) one or more TV displays in the venue, each showing a curated slice of the menu (e.g., Screen 1 = domestic beers, Screen 2 = draft, Screen 3 = specials). Changes propagate to all surfaces within seconds.

**Phase 1 also ships an AI-ready REST API and MCP server** (§3.7) — the full programmatic management surface with confirmation flows and audit attribution. **Phase 2 (future)** adds messaging adapters (Slack/Discord/SMS) on top of that surface so staff can make changes in natural language from a channel they already use ("we're out of Coors," "raise all beer prices $0.50").

### 1.1 Problem

Menu changes at small venues are painful: items sell out mid-shift, prices change, specials rotate daily. Today this means editing a website (or calling whoever built it), reprinting menus, and manually updating TV slides in PowerPoint or a consumer signage app. Nothing stays in sync, and nobody knows who changed what.

### 1.2 Goals

1. Owner/staff can 86 an item in under 10 seconds from a phone.
2. All surfaces (web menu, every TV) reflect a change within 30 seconds without manual refresh.
3. TVs are zero-maintenance after initial pairing: they recover from power loss, wifi drops, and browser restarts without staff intervention.
4. Every mutation is attributed (who, what, when, via which surface) and revertable.
5. The service layer is chat-ready: Phase 2 adds a bot without refactoring Phase 1 code.

### 1.3 Non-Goals

- Multi-tenancy. One venue, one database. (Schema decisions should not actively preclude it, but no tenant_id plumbing, no org management.)
- Online ordering, payments, inventory counts, or POS integration.
- Printed menu generation (nice-to-have later; not scoped).
- Native mobile apps. Admin UI is responsive web.
- In-app chat UI. Phase 2 chat happens in Slack/Discord/SMS, not in the product.

---

## 2. Users & Roles

| Role | Who | Can do |
|---|---|---|
| **Owner** | Client (1–2 accounts) | Everything: items, prices, categories, screens, users, display pairing, revert changes |
| **Staff** | Bartenders/servers (2–10 accounts) | Toggle availability (86/un-86), edit item descriptions; **cannot** change prices, delete items, manage screens or users |
| **Display** | A TV, not a person | Read-only render of its assigned screen via token |
| **Public** | Menu viewers | Read-only web menu |

Role checks live in the service layer, not the UI — Phase 2 bots call the same functions and inherit the same enforcement.

---

## 3. Phase 1 Scope

### 3.1 Menu Management (Admin UI)

**Items**
- CRUD: name, description, price (integer cents), category, tags, sort order, image (optional), availability flag.
- `aliases` field (text array): alternate names staff use ("chicken fingers" → "Hand-Breaded Chicken Tenders"). Invisible to public; used by admin search now, chat resolution in Phase 2.
- **Typed attributes** (all optional per item): structured data that renders on menus, distinct from tags. Launch registry: `abv` (number, "5.2% ABV"), `ibu` (number, "IBU 38"), `flavor_profile` (short text, "smoky · citrus · bitter"), `origin` (short text), `calories` (number). Which attributes *display*, and in what order, is decided by the item's category (see Item Display Schema below) — so drafts show ABV/IBU, cocktails show flavor profile, burgers show none, without per-item layout fiddling. Registry is a curated enum in code, not user-defined fields (single-tenant; adding one later is a 10-minute change, while a user-defined field builder is a project).
- One-tap availability toggle, prominent in UI and optimized for mobile. This is the most-used action in the product; it must never be more than two taps from opening the admin on a phone.
- Price variants (optional per item): e.g., pint/pitcher, cup/bowl. Model as child price rows, not separate items.

**Categories**
- CRUD, typed as `food` or `drink`, ordered.

**Tags**
- Many-to-many with items. Every tag has a **visibility**: `public` or `private`.
  - **Public tags** render as badges on the web menu and TV screens: label + optional icon + color (e.g., 🌶️ spicy, 🌱 vegan, GF, ⭐ new). Seed set: `spicy`, `vegan`, `vegetarian`, `gluten-free`, `new`, `house-favorite`.
  - **Private tags** are organizational only — they drive screen queries, bulk operations, and Phase 2 chat filters, and never render on any public/display surface. Seed set: `domestic`, `import`, `draft`, `bottle`, `can`, `special`, `happy-hour-eligible`.
- Visibility is a property of the tag itself (set once at tag creation, editable by owner), not per-item — one source of truth for "does this badge show."
- Both kinds are usable in screen queries and bulk ops; the split is purely about rendering.

**Item Display Schema (per category)**
- Each category defines how its items render on public/display surfaces: which typed attributes appear and in what order, and where badges sit. Examples:
  - *Draft Beer:* Name · ABV/IBU line · Price. No description on TV (density), description on web.
  - *Cocktails:* Name · flavor profile · description · price.
  - *Entrées:* Name · badges · description · price.
- Implemented as `display_config` on the category (attribute order, show/hide description per surface). Screen templates consume this — the `list` template asks the category "what's this item's display line," it doesn't hardcode fields.
- Ship with sensible per-category-type defaults (food vs drink) so onboarding doesn't require configuring anything; owner can tweak per category.

### 3.1a Images (Phase 1)

- Upload from admin UI (drag-drop + mobile camera), one primary image per item; categories and screens may also have a background/hero image.
- Storage: Vercel Blob or Cloudflare R2 (recommend R2 — cheap, S3-compatible, no egress fees for the TV polling case). Store the key, serve via CDN URL.
- Server-side processing on upload: strip EXIF, generate sized variants (thumb / card / display-quality ~1920w), enforce type (jpeg/png/webp) and size limits (e.g., 10MB in, webp out). Never serve user-uploaded bytes unprocessed — this is also the security posture (no SVG uploads, content-type validated by magic bytes not extension).
- TV rendering: `grid` and `spotlight` templates use images; `list` stays text-dense. Preload images on version change before swapping content so screens never show pop-in.
- Public menu uses responsive variants (next/image).

**Bulk operations (admin UI)**
- Multi-select items → set availability, change category, add/remove tag.
- Bulk price adjust by filter (category or tag): flat delta or percentage, with a **preview diff before apply** (item, old price, new price). This preview→apply flow is the same code path Phase 2 chat confirmations will use.

### 3.2 Screens (TV Display Management)

**Screen definition**
- A screen has: name, layout template, content source, and display options.
- **Content source, two modes:**
  - *Query mode:* "all items with tag `draft`, ordered by sort_order" — auto-updates as items change.
  - *Manual mode:* explicit ordered item list — for curated screens.
- Unavailable items: per-screen setting — hide entirely, or show with an "86" treatment (strikethrough/badge). Default: hide.

**Layout templates (ship 2–3, not a builder)**
- `list` — single column, item + price. Dense; good for beer lists.
- `grid` — 2–3 columns with optional images. Good for food.
- `spotlight` — 1–4 large featured items. Good for specials.
- Per-screen options: title, accent color, font scale, columns, and per-surface toggles (show descriptions? show badges? show attributes?) for density control on TVs.
- Templates don't hardcode item fields — they render each item via its category's display schema (Section 3.1). A `list` screen mixing drafts and cocktails renders ABV for one and flavor profile for the other automatically.
- No drag-and-drop layout editor in Phase 1 — templates with knobs, period. (A layout builder is the classic scope-killer for signage products.)

**Overflow rule:** content that exceeds the screen either (a) auto-scales font down to a floor, then (b) paginates on a timed rotation (configurable interval, default 12s). Never scrolls, never clips silently.

**Preview:** admin UI renders a live 16:9 preview of any screen exactly as the TV renders it (same route, same code).

### 3.2a Scheduled Screens (Phase 1)

- Each **display** gets an optional weekly schedule: ordered rules of `(days, start_time, end_time) → screen`, plus a default screen when no rule matches. Example: TV-2 shows *Happy Hour* Mon–Fri 4–7pm, otherwise *Draft List*.
- Evaluated server-side against venue-local timezone (venue setting) at poll time — the display just asks "what's my current screen + version," so schedule changes propagate like any other change and no clock logic lives on the TV.
- Happy hour pricing pattern: the *Happy Hour* screen shows items with their `happy hour` price variant (or dedicated items). Real prices in the DB never mutate on a schedule — no daily audit noise, nothing to roll back if a job misfires.
- Schedule changes are audited like everything else.

### 3.3 Display Runtime (the TV itself)

- Any device with a browser: Fire TV Stick, Chromecast with Google TV, TV built-in browser, spare laptop. No custom hardware or app. **Venue is wifi-only (confirmed)** — recommend Fire TV Stick 4K + kiosk browser (e.g., Fully Kiosk), positioned for best signal; resilience behavior below is a hard requirement, not defense-in-depth.
- **Pairing:** TV navigates to `/display` → shows a 6-character pairing code → owner enters code in admin UI and assigns a screen → TV receives a long-lived, revocable, read-only display token (localStorage) and starts rendering.
- **Updates:** poll every 15–30s with a lightweight version check (ETag or version number); re-render only on change. SSE is a Phase 1.5 upgrade if polling feels laggy in practice; polling ships first because it survives flaky venue wifi.
- **Resilience requirements:**
  - Wifi drop → keep rendering last-known content, retry with backoff, show a subtle offline indicator (visible up close, invisible from across the bar).
  - Power loss → device boots into kiosk browser → token in localStorage → resumes with no human involvement.
  - Nightly full page reload (e.g., 4am) to clear memory leaks in cheap TV browsers.
- **Reassignment:** owner can point a paired display at a different screen from the admin, remotely.

### 3.4 Public Web Menu

- Single responsive page at the venue's domain/subdomain: categories, items, prices, descriptions, public-tag badges, and typed attributes per each category's display schema. Private tags never render here. Unavailable items hidden (or badged — venue setting).
- Server-rendered, cached, revalidated on menu mutation. QR-code friendly (this URL goes on table tents).
- SEO basics: proper headings, schema.org `Menu` markup.

### 3.5 Audit Log & Revert

- Every mutation writes an audit row: actor (user or display/system), action, entity, before/after JSON, timestamp, surface (`admin_ui` now; `slack`/`discord`/`sms` reserved for Phase 2).
- Admin UI: "Recent changes" feed, filterable by user/entity.
- **Revert:** single-entity changes revertable with one click (writes a compensating change, also audited). Bulk operations revert as a group.
- Retention: keep everything; volume is trivial at this scale.

### 3.6 Auth & Security (Phase 1)

- Better Auth, email+password, owner-invites-staff flow. No self-signup.
- Session-based auth for admin; role enforcement in service layer.
- Display tokens: random 256-bit, hashed at rest, scoped to one display, read-only endpoints only, revocable individually.
- Public menu and display routes: no auth, but rate-limited and served cached — they expose only data the venue already displays publicly.
- Standard hardening: Zod validation on every input at the service boundary, parameterized queries via Drizzle, CSP headers on display/public routes, HTTPS only, secure/httpOnly cookies, CSRF protection on admin mutations.
- Backups: daily automated Postgres backups; restore procedure documented and tested once.

### 3.7 AI-Ready API & MCP Server (Phase 1)

Phase 1 ships a programmatic management surface even though no chat bot ships. Two layers over the same service functions:

**REST API** (`/api/v1/**`)
- Endpoints mirror the service layer 1:1: search/list items, set availability, update item, adjust prices (dry-run + apply), manage tags on items, read/update screens, read audit log, list/confirm pending changes.
- Auth: API keys (hashed at rest, owner-managed in admin UI) with scopes — `read`, `write:availability`, `write:items`, `write:prices`, `write:screens`. A key carries an actor identity so audit attribution works ("API key: menu-bot").
- Per-key rate limiting; keys revocable individually; last-used timestamp visible in admin.

**MCP Server**
- Exposes the same operations as MCP tools: `search_items`, `set_availability`, `update_item`, `preview_price_adjustment`, `apply_pending_change`, `list_86d`, `get_screen`, `update_screen`, `get_recent_changes`.
- Tool design rules (binding):
  - Bulk/price/destructive tools are **two-step**: a `preview_*` tool creates a `pending_changes` row and returns the diff + ID; a separate `apply_pending_change(id)` commits it. The AI client physically cannot skip the preview — the apply tool only accepts server-issued IDs, and pending changes expire (15 min).
  - Single-item availability toggles execute in one step (matching the product's trust model).
  - Tools return structured results including what changed, so any AI client can narrate accurately.
  - All inputs Zod-validated; no tool accepts raw SQL, raw filters, or unbounded operations (bulk ops require a tag/category filter).
- Auth: MCP connections authenticate with a scoped API key like any other client.
- **Immediate payoff:** connect Claude (claude.ai connector or Claude Desktop) to this MCP server and the "we're out of Coors" demo works on day one — no bot, no adapter, no chat UI. Phase 2's Slack/Discord/SMS adapters become thin message-transport wrappers around an already-proven tool surface.

**Security posture:** the API/MCP surface enforces the same role/scope checks, pending-change confirmation flow, audit logging, and rate limits as the admin UI — an AI client is just another authenticated actor with the narrowest scopes that work. Worst case from a confused or adversarial AI client is bounded by scopes + the two-step apply + one-click revert.

### 3.8 Settings (Phase 1, owner-only)

Rule of thumb: settings holds configure-rarely concerns; anything touched weekly (items, screens, schedules) lives in the main UI. Organized as tabs:

**Venue**
- Name, logo, address, phone, social links (rendered on public menu footer), business hours (display-only on public menu; not tied to scheduling logic).
- **Timezone** — drives display schedules (§3.2a); changing it shows a warning about schedule impact.
- Currency/price formatting: symbol, show/hide trailing `.00` (bars often prefer `6` over `$6.00` on TVs — per-surface toggle: web vs display).

**Branding**
- Logo upload (uses §3.1a image pipeline), brand color palette (primary/accent), font choice from a curated set (3–5 licensed/Google fonts, not a font picker free-for-all).
- These set the *defaults* for public menu and screen templates; individual screens can still override accent color per §3.2.

**Menu Behavior**
- Global default for unavailable-item treatment (hide vs 86-badge) on web and displays — per-screen setting still overrides.
- Public menu options: show/hide images, show/hide public-tag badges, SEO title/description.
- QR code generator: renders/downloads a print-ready QR (SVG + PNG) pointing at the public menu — table tents, no third-party QR service with tracking redirects.

**Users**
- Invite staff by email, assign role (owner/staff), deactivate/reactivate, force password reset. Deactivation kills sessions immediately.
- At least one active owner enforced (can't demote/deactivate the last owner).

**Displays**
- List of paired displays: name, assigned default screen, schedule summary, last-seen heartbeat (green <2 min, yellow <10, red offline), revoke button.
- "Pair new display" entry point (enter the code the TV shows).
- Revoking a token blanks that TV to a re-pair screen on its next poll.

**API Keys** (§3.7 management UI lives here)
- Create key (name + scope checkboxes), shown once, hashed at rest; list with scopes, created, last-used; revoke.

**Data & Recovery**
- Backup status (last successful backup timestamp — read from provider or heartbeat job).
- One-click full export: JSON dump of menu, screens, settings (client owns their data; also your migration/insurance story).
- Link to Recent Changes / revert UI (the feature lives in main nav; settings just cross-links).

**Sessions & Security**
- Active sessions list per user with revoke; "sign out everywhere."
- Owner password change; optional TOTP 2FA for owner accounts (cheap with Better Auth, meaningful protection for the account that can change prices).

All settings mutations are audited like everything else (`entity_type: setting`). Settings reads/writes go through the service layer, so the MCP/API surface can expose read-only settings access later if useful — but **no settings-write scope exists in Phase 1**: neither API keys nor chat should ever be able to change timezone, users, or branding. That surface stays human-only.

---

## 4. Phase 2 Scope (Specified, Not Built)

> Everything in this section informs Phase 1 architecture but ships later. Phase 1 is **done** without any of it. Note: with §3.7's MCP server shipping in Phase 1, Phase 2 is reduced to *messaging adapters + identity mapping* — the tool surface, confirmation flow, and security model already exist and are proven.

### 4.1 Conversational Menu Control

Staff make changes from a chat channel the venue already uses. Launch adapter priority: whichever the client uses — likely Discord or SMS (Twilio); Slack supported. Adapters are thin (~100 lines each) behind a common interface: `receiveMessage`, `reply`, `requestConfirmation`.

**Core interactions:**
| Utterance | Behavior |
|---|---|
| "We're out of Coors" | Resolve via search + aliases → if ambiguous (Coors Light vs Banquet), ask → set unavailable → confirm reply |
| "Chicken fingers are back" | Resolve → set available → confirm reply |
| "Raise all draft beers $0.50" | Filter by tag → generate preview diff → post diff + confirm button → apply only on confirmed click by authorized user |
| "What's 86'd right now?" | Read-only query, reply with list |
| "Put the fish sandwich on the specials screen" | Tag/screen mutation with confirmation |

**Design rules (binding on Phase 1 architecture):**
1. **The bot calls the same service functions as the admin UI.** No parallel logic, no LLM-generated SQL, ever. Tools are a hard allowlist.
2. **Propose → confirm → apply** for anything bulk, price-related, or destructive. Single-item availability toggles execute immediately.
3. **Dry-run mode on service functions** so previews come from real code paths, not model imagination. (Phase 1's bulk-price preview already builds this.)
4. **Identity mapping:** chat platform user ID → app user, via one-time link flow. Unmapped users get nothing executed. Role enforcement is the service layer's job — a staff member asking for a price change gets "needs owner approval," and the bot pings the owner with a confirm button.
5. **Confirmation payloads live server-side** (pending-change record; button carries only an ID + signature). No client-forgeable values.
6. Webhook signature verification (Slack signing secret / Discord interaction sig / Twilio signature) on every inbound request; channel allowlist; per-user rate limits.
7. Every bot-initiated mutation audits with surface + chat user attribution.

**Bot as change feed:** the bot also posts summaries of admin-UI changes to the channel ("Gary updated Screen 2"), making the channel the complete change history for the whole team.

### 4.2 Phase 1 Architectural Commitments for Phase 2 Readiness

- [ ] All mutations flow through a service layer with (actor, input) signatures — UI route handlers are thin wrappers.
- [ ] `aliases` column exists and is populated during onboarding.
- [ ] Bulk operations implement preview (dry-run) / apply as separate steps.
- [ ] Audit log has a `surface` column with reserved enum values.
- [ ] Pending-changes table exists in schema (used by bulk preview flow in Phase 1; reused for chat confirmations in Phase 2).
- [ ] Role checks live in the service layer, not middleware/UI alone.

---

## 5. Technical Architecture

**Stack:** Next.js (App Router) · Postgres + Drizzle ORM · Better Auth · Vercel (app) + Neon or Railway (Postgres). No Redis, no queues, no websockets in Phase 1 — nothing at this scale needs them.

### 5.1 Data Model (summary)

```
users            id, email, name, role (owner|staff), created_at
items            id, name, description, price_cents, category_id,
                 is_available, sort_order, image_url, aliases text[],
                 attributes jsonb,   -- {abv: 5.2, ibu: 38, flavor_profile: "..."}
                 created_at, updated_at
item_price_variants  id, item_id, label, price_cents, sort_order
categories       id, name, type (food|drink), sort_order,
                 display_config jsonb  -- attribute order, per-surface show/hide
tags             id, name, visibility (public|private),
                 icon, color            -- icon/color used for public badges
item_tags        item_id, tag_id
screens          id, name, template (list|grid|spotlight),
                 source_mode (query|manual), source_config jsonb,
                 display_options jsonb, background_image_key, version int
screen_items     screen_id, item_id, sort_order        -- manual mode
displays         id, name, screen_id,                  -- default screen
                 token_hash, paired_at, last_seen_at, revoked_at
display_schedules id, display_id, days int[], start_time, end_time,
                 screen_id, priority
api_keys         id, name, key_hash, scopes text[],
                 last_used_at, revoked_at, created_at
venue_settings   singleton row: name, logo_image_id, address, phone,
                 social jsonb, hours jsonb, timezone,
                 currency_format jsonb, branding jsonb (colors, font),
                 menu_behavior jsonb (86 treatment, badges, images, seo)
images           id, key, variants jsonb, created_at   -- R2/Blob refs
pairing_codes    code, created_at, expires_at, claimed_display_id
pending_changes  id, actor_id, change_type, payload jsonb,
                 status (pending|applied|expired|cancelled), expires_at
audit_log        id, actor_type (user|display|system),
                 actor_id, surface, action, entity_type, entity_id,
                 before jsonb, after jsonb, created_at
```

Notes: prices always integer cents. `items.attributes` is jsonb for flexibility but validated at the service boundary against the attribute registry (Zod schema) — no arbitrary keys ever reach the DB. `screens.version` increments on any content-affecting change (including changes to items a query-mode screen matches) — displays poll this. `source_config` for query mode: `{tag_ids?, category_ids?, order_by}`.

### 5.2 Key Routes

```
/admin/**            auth'd admin UI
/menu                public web menu (cached, ISR/revalidate-on-write)
/display             unpaired → pairing code screen
/display/render      paired → renders assigned screen (token auth)
/api/display/poll    version check endpoint (token auth, cheap)
/api/...             service-layer-backed mutations (session auth)
```

### 5.3 Update Propagation

Mutation → service layer → DB write + audit row → bump affected `screens.version` → revalidate `/menu` cache. Displays detect version change on next poll (≤30s worst case, typically ≤15s). This meets Goal #2 with zero realtime infrastructure.

---

## 6. Success Metrics

- Time-to-86 from phone lock screen: **< 10s** (measured in real use with client's staff).
- Change-to-TV propagation: **p95 < 30s**.
- Display uptime: no staff-initiated TV interventions after week 1 of install.
- Client renews/expands (Phase 2 chat upsell accepted) — the business metric that matters.

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cheap TV browsers choke on rendering | Templates use plain CSS, no heavy JS; nightly reload; test on actual Fire Stick early |
| Venue wifi unreliable | Poll+cache design; offline indicator; last-known-content rendering |
| Layout requests balloon ("can it flash? animate? show video?") | Templates-with-knobs stance stated in contract; changes are paid scope |
| Staff share one login, killing attribution | Cheap per-staff accounts, owner-managed; make invite flow trivial |
| Phase 2 chat misfires a change | Confirmation flow + revert button + audit trail; worst case is a one-click undo |

## 8. Resolved Decisions (formerly Open Questions)

1. **Connectivity: wifi only.** No ethernet near TVs. Hardware recommendation: Fire TV Stick 4K (or equivalent Android TV stick) in kiosk mode with the Fully Kiosk browser or similar. The poll+cache+offline-indicator design in §3.3 is now load-bearing, not defensive — test degraded-wifi behavior explicitly before install.
2. **Images: in Phase 1.** See §3.1a.
3. **Happy hour: in Phase 1 as scheduled screen swaps** (the recommended shape). See §3.2a. Time-based *price mutation* remains out of scope — happy hour pricing is represented as price variants shown on the happy-hour screen, not as automated price rewrites (which would pollute the audit log daily and create failure modes at rollback time).
4. **Chat platform: undecided — and moot for now.** Phase 1 ships an **AI-ready API + MCP server** (§3.7) so any chat surface (or Claude directly as an MCP client) can manage the menu. Bot adapters remain Phase 2.
5. **Domain: standalone.** Fresh domain, admin + menu + display all under it (`admin.`, `menu.` or `/menu`, `/display`).

## 9. Phase 1 Milestones

1. **M1 — Core CMS:** schema, auth, items/categories/tags CRUD (attributes, public/private tags, display schemas), image upload pipeline, availability toggle, audit log, settings: Venue + Users tabs. *(Admin can fully manage a menu with images.)*
2. **M2 — Displays:** screen definitions, templates (image-capable grid/spotlight), pairing flow, poll/render runtime, display schedules (happy hour), public web menu on standalone domain, settings: Branding + Menu Behavior + Displays tabs. *(TVs live in the venue, swapping screens on schedule.)*
3. **M3 — API/MCP + polish:** REST API + API keys/scopes, MCP server with two-step confirmation tools, bulk ops with preview/apply, revert UI, recent-changes feed, settings: API Keys + Data & Recovery + Sessions/2FA tabs, QR generator, onboarding (seed real menu, aliases, images), backups verified, Fire Stick install runbook, **demo: Claude connected via MCP 86ing an item live on the TV.**
