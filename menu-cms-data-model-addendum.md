# Data Model Addendum — Modifiers, Variants & Real-Menu Coverage

**Status:** Proposed (supersedes PRD §5.1 where they conflict). Produced 2026-07-09 from a three-design panel (minimal-extension / fully-normalized / admin-UX-first) scored by fidelity, buildability, and evolution judges.

**Why this exists:** PRD §5.1 predates the real menu data. The extracted menus require add-ons, section-wide rules, reusable choice groups, substitution repricing, unpriced items, and typed drink attributes that §5.1 cannot represent. Owner decision: the system must handle all of it.

**Base:** All PRD §5.1 tables are kept. Changes below are additive except where marked **modified**.

---

## 1. New tables

### `modifier_groups`
A named, reusable choice set (add-ons, section defaults, required choices).

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | e.g. "Wing Sauce Choice", "Burger Defaults" |
| selection_type | text | CHECK `single` \| `multiple` |
| min_select | int | default 0 |
| max_select | int NULL | null = unlimited |
| is_required | bool | default false |
| sort_order | int | |
| created_at | timestamptz | |

### `modifier_options`
One selectable option in a group, with **disambiguated pricing semantics**.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| group_id | uuid fk | |
| label | text | |
| linked_item_id | uuid fk items NULL | ties option to a real catalog item (e.g. a Side) |
| pricing_mode | text | CHECK `included` \| `delta` \| `replacement` \| `ambiguous` |
| price_delta_cents | int NULL | **NULL until resolved** — never default 0 |
| replacement_price_cents | int NULL | used when mode = replacement |
| raw_price_text | text NULL | verbatim source text kept while mode = ambiguous |
| sort_order | int | |
| is_available | bool | default true |

**Fail-safe rule (hard requirement):** a shared render helper — not per-template logic — refuses to display any price for an option with `pricing_mode = 'ambiguous'`. Prices stay NULL until a human resolves them via two explicit admin buttons: "this is the new total" (→ replacement) vs "this is added to base" (→ delta). A dashboard view lists all unresolved options ("N substitution options need pricing confirmed") linking straight into the item's Modifiers section.

### `modifier_group_attachments`
Attaches one group to a single item **or** an entire category (fan-out to current and future items).

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| group_id | uuid fk | |
| item_id | uuid fk NULL | exactly one of item_id / category_id non-null (CHECK) |
| category_id | uuid fk NULL | |
| sort_order | int | |

Admin UX requirement: category-level group edits show **"applies to N items"** with a one-item live preview before save, so fan-out is never silent.

### `item_modifier_option_exclusions`
Lets one item drop a **single option** from an inherited category-level group without forking the group (e.g. an already-double burger excludes "Add ½ lb patty" while keeping the bun swap and veggie sub).

| column | type | notes |
|---|---|---|
| item_id | uuid fk | |
| option_id | uuid fk modifier_options | pk (item_id, option_id) |

Admin UX: inherited groups render as read-only chips with an "exclude for this item" link.

## 2. Modified tables

### `items` (modified)
- `price_cents` → **nullable**.
- New `pricing_type` text CHECK `fixed` \| `ask_server` \| `tbd`, default `fixed`. Distinguishes Dessert of the Day's genuine "Ask your server" from "price not entered yet" (Pepsi products, all drinks currently). Makes "show me everything unpriced" a WHERE clause.
- New `featured_slot_key` text NULL (e.g. `drink_of_the_week`, `dessert_of_the_day`) with partial UNIQUE index `WHERE featured_slot_key IS NOT NULL` — exactly one holder per slot. Slot reassignment MUST be a single-transaction service function (clear old holder + set new), covered by a test.
- Typed-attribute registry gains `style` (text) alongside abv/ibu/etc. — draft beer rows carry `{abv: 5.4, style: "Hefeweizen"}`.

### `item_price_variants` (modified)
- New `kind` text NOT NULL DEFAULT `size` CHECK `size` \| `happy_hour`. Replaces the PRD's fragile free-text label matching for happy hour. Screens select happy-hour pricing via an explicit `display_options.price_mode = 'happy_hour'` flag; scheduling stays in the existing `display_schedules` — **no second schedule subsystem**.
- Upgrade path (deliberately deferred): if a third time-based regime ever appears (brunch, late-night), migrate `kind` to a `price_tiers` lookup table. Not built now — zero real happy-hour data exists yet.

### `categories` (modified)
- New `tagline` text NULL — display copy like "★ Made to Share!" kept separate from the canonical name (cleaner audit diffs than a jsonb convention key; there is no live DB, so the column is free).

### `audit_log` (convention)
- `entity_type` values reserved now: `modifier_group`, `modifier_option`, `modifier_group_attachment`, `item_modifier_option_exclusion` — same registry as PRD §4.2 so Phase-2 MCP mutations use consistent naming from day one.

## 3. How the real menu maps (spot examples)

| Real pattern | Representation |
|---|---|
| RPM Burger: add cheese $0.52 / bacon $1.04 / egg $1.04 | Group "RPM Burger Add-ons" (multiple), options mode=delta 52/104/104, attached to the item |
| All burgers: veggie patty $2.08, GF bun $1.56, 2nd patty $4.16 | Group "Burger Defaults" attached to category=Burgers |
| Wing sauces (12 options, 3 items) | One group "Wing Sauce Choice" (single, required), 12 included options, 3 attachment rows |
| Monster Reuben full $16.63 / Half $14.55 | `item_price_variants` kind=size |
| BLT "Sub grilled salmon $10.63" | Option mode=**ambiguous**, raw_price_text kept, blocked from public render until resolved |
| Sandwiches include one side (12 sides) | Group "Included Side" (single, required, all included) attached to category; each option `linked_item_id` → a Sides item so sides can gain a-la-carte prices later |
| Dessert of the Day | price_cents NULL, pricing_type=ask_server, featured_slot_key=dessert_of_the_day |
| Drink of the Week (The Ginny Runner) | featured_slot_key=drink_of_the_week |
| Draft beer ABV/style | attributes jsonb via typed registry |
| Bottles/Cans (name-only) | items with price_cents NULL, pricing_type=tbd |
| GF / N/A drinks | public tags (`gluten-free`, `non-alcoholic`) — Tag component needs tones for these (design gap already logged) |

## 4. Explicitly rejected (and why)

- **`rendered_modifiers_cache` jsonb on items** — premature optimization; invalidation spans 4+ tables, silent-stale risk, render load is trivial (a handful of items polled every 15–30s).
- **Dedicated happy-hour/price-tier schedule tables** (`happy_hour_windows`, `price_tier_schedules`) — duplicates `display_schedules`; two "when is X active" mechanisms confuse a 2-admin venue.
- **Per-attachment min/max/label overrides + scoped options** (full-normalization extras) — largest admin-UI surface of the panel for needs the real menu doesn't demonstrate; option-level exclusions cover the actual case.

## 5. Open items (blocking data entry, not schema)

1. **Drink prices** — none provided for bottles/cans/draft/Drink of the Week. Import as pricing_type=tbd; owner to supply.
2. **Ambiguous substitution prices** — salmon sub $10.63, shrimp tacos $14.55, chicken Caesar $15.59: replacement or upcharge? Resolve via the admin disambiguation flow (or owner answers now and we import clean).
3. **Bulk-ops scope decision** — Phase 1 bulk price-adjust reaches `items.price_cents` only; it does NOT touch modifier option deltas or happy-hour variants. This is a documented, owner-communicated gap ("raise all beer prices" won't move add-on prices).
4. Content cleanups from review: split "Southwestern or Philly Eggrolls"?, Sweet/Unsweet Tea one item or two?, "Mich/Mic Ultra" normalization, "japs" → jalapeños, glare-obscured price verification.
