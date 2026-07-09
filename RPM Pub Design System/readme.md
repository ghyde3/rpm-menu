# RPM Pub Design System

Brand + product design system for **RPM Full Service Patio Pub & Grill** — Newnan, Georgia's own neighborhood dive, recycled from a 1960's service station and owned & operated by Kelly & Joe Rizzo. 17-seat full bar, 15 rotating taps, an eclectic dining room with acoustic music / trivia / karaoke / open mic, a full pub kitchen (custom flavored jumbo wings, 8oz Angus burgers, Bavarian pretzels, Monster Reubens, bistro specials), and a dog-friendly patio.

This system powers a **minimal menu CMS** for a single restaurant plus two customer-facing surfaces: a **mobile menu** and a **TV display board**. The look is dive bar / biker / kustom-kulture — a distressed black chalkboard, hot-rod red & flame-orange lettering, beer-amber prices, dotted leader lines, garage grit.

## Sources
- `uploads/Screenshot 2026-07-09 at 3.17.13 PM.png` — photo of the printed RPM menu board. Sole visual reference; all colors, type feel, price treatment, section structure, and menu copy are transcribed from it.
- Company blurb supplied in the brief (history, ownership, food, patio).
- **No** codebase, Figma, logo file, or brand fonts were provided. See caveats below.

---

## CONTENT FUNDAMENTALS

The voice is a **wisecracking dive bar** — proud, warm, a little rowdy, never corporate.

- **Item names are the joke.** Menu items get punny, pop-culture, biker-flavored names: *Monster Reuben, Cod of Thunder, The Bratweiler, Chicken Jabroni, The Frankster, Road Dogs, The Hungry Hippie, Cheech & Chong, Master Blaster sauce.* Straight descriptions sit underneath in plain, appetizing language.
- **Casing:** headers and item titles are **ALL CAPS**. Descriptions are sentence case.
- **Descriptions** are short, punchy, comma-run sentences full of sensory detail: "Corned beef, kraut, swiss & thousand island on toasted marble rye." Uses `&` and `w/` freely; abbreviations like "o-rings", "provo", "po' boy" are on-brand.
- **Person:** menu copy is largely impersonal/imperative ("Ask your server", "Try them tossed in your choice of wing sauces!"). CMS UI speaks to the operator plainly ("On the board", "Publish to Board", "86'd").
- **Bar slang is welcome:** "86'd" for out-of-stock, "on the board", "on tap", "the lineup".
- **Prices** never show a leading `$` on the board — dollars are big, cents are small superscript (12⁹⁹). The `$` only appears in the CMS input.
- **Punctuation flourish:** amber ★ stars flank section headers ("SANDWICHES ★ BASKETS ★ DOGS"), and taglines run with · middots.
- **Emoji:** none. The only "icon" characters used are the ★ star and a ● status dot. Keep it typographic.
- **Tone examples:** "Big pile of greens…", "Our monster po' boy stuffed w/…", "rolled up fat", "Live Music ★ Pet Friendly Patio".

---

## VISUAL FOUNDATIONS

**Overall vibe:** a dim, warm, distressed chalkboard bolted to a garage wall. Flat, hard-edged, high-contrast, matte. Nothing glossy, nothing soft, nothing rounded unless it's a status dot.

- **Color:** near-black board (`--rpm-ink #121110`) washed with a subtle top-to-bottom gradient (`--board-wash`). Lettering is **hot-rod red** (`#d63a2c`, section headers + primary actions) and **flame orange** (`#e8632a`, item titles). Prices are **beer amber** (`#e5b833`). A **kustom green** (`#a8c81e`) is the rare accent — "new", "on tap", availability ON. Body copy is warm **cream** (`#f2ead9`) fading to bone/steel for secondary text.
- **Type:** three families. **Anton** (heavy condensed caps) for board section headers; **Oswald** (condensed grotesque, 700 *italic* caps) for item titles, labels, prices; **Zilla Slab** (slab serif) for descriptions and running copy. **Bungee** appears only in the RPM wordmark and occasional TV flourish. Headers carry a hard `0 2px 0 rgba(0,0,0,.45)` text-shadow to sit on the board.
- **Spacing:** 4px base grid (`--sp-1`…`--sp-9`). Menu rows breathe with 24px (`--row-gap`) gaps; descriptions cap around 52ch.
- **Backgrounds:** the board wash + a faint dot **grain** overlay (`--grain`, ~2% white dots) and, on the TV, a **vignette** darkening the edges. No photography in the base system (none was provided); imagery, if added, should read warm and gritty.
- **Borders & radii:** deliberately **square**. `--radius-sm 2px` for inputs/chips, `--radius-md 4px` for cards/buttons, `6px` max for modals. Round only status dots/toggles. Borders are chunky: `2px` default controls, `3px` accent rules (a red left-rule flags the active/featured panel), hairlines in soot `#302c28`.
- **Shadows:** hard and low, never a soft glow — `0 2px 0 rgba(0,0,0,.6)` stacked with a wide dark drop. A red/green **glow** is reserved exclusively for the TV board's live status and the CMS "Board Live" dot.
- **Dotted leaders:** the signature move — a `2px dotted` rule (`--leader-dots #4a443d`) runs from each item title to its price, straight off the printed board.
- **Hover:** primary buttons darken to `--accent-primary-press`; outline/ghost controls fill with `--surface-hover` and brighten their text; tags/chips stay put. **Press:** buttons nudge `translateY(1px)` — no scale bounce.
- **Focus:** inputs swap their border to hot-rod red. Visible, chunky, no soft ring.
- **Animation:** minimal and utilitarian. `--dur 180ms` / `--dur-fast 120ms` on the `--ease` cubic curve for color/border/transform. The TV board cross-fades between pages on a 9s timer; the mobile menu smooth-scrolls to categories. No bounces, no parallax, no decorative loops.
- **Transparency/blur:** used sparingly — the mobile header/nav sit on `rgba(18,17,16,.7)` with a 6px backdrop blur so content scrolls under them. Elsewhere surfaces are opaque.
- **Cards:** matte `--surface-raised #1c1a17`, `2px` hairline border, `4px` radius, a hard `0 1px 0` shadow. `accent` variant adds a `3px` red left rule.

---

## ICONOGRAPHY

RPM's iconography is **typographic, not illustrative** — matching the printed board, which uses no icon set at all.

- **No icon font, no SVG icon library** in the source. The system deliberately avoids hand-drawn SVG icons.
- The only glyphs used are Unicode: **★** (amber star, flanks section headers & the footer ticker), **●** (status dot, "on tap" / "Board Live"), **⌕** (search affordance, mobile), **⠿** (drag handle, CMS), **×** (close). These are set in the type stack, not as images.
- **Emoji are never used.**
- **The printed board features a Rat Fink / Ed-Roth-style hot-rod monster illustration.** That artwork was **not provided as a file** and is not reproduced here (see caveats). Where a brand illustration would go, surfaces currently use the typographic wordmark + star motifs. If/when the original art is supplied, drop it into `assets/` and reference it — do not redraw it.
- **Logo:** none supplied. The "RPM" wordmark is **type-set** (Bungee, with a red "R") — see `cards/brand-wordmark.html`. Do not fabricate a logo mark.

---

## Components
Reusable primitives (compiled to `window.RPMPubDesignSystem_cc2ec6`). Each has a `.jsx`, `.d.ts`, `.prompt.md`, and a directory card.

**Menu (`components/menu/`)**
- **SectionHeader** — big Anton caps board header (red/orange, optional ★ flankers).
- **MenuItem** — the core board row: title → dotted leader → price, description, tags, 86'd state.
- **MenuSection** — a full category: header + stacked MenuItems (data- or children-driven).
- **PriceTag** — big dollars + raised superscript cents (12⁹⁹), amber.
- **Tag** — small caps attribute chip (New / Spicy / Veggie / Fan Fave / default).

**Core (`components/core/`)**
- **Button** — chunky flat action button (primary / secondary / ghost / danger; sm/md/lg).
- **Input** — labeled dark text field; border lights red on focus; optional `$` prefix.
- **Textarea** — multi-line dark field for descriptions.
- **Switch** — availability toggle, green when on ("86 it" when off).
- **Card** — matte raised panel; `accent` adds a red left rule.

## UI Kits
Full-surface recreations under `ui_kits/` (each: `index.html` + screen `.jsx` + `README.md`). Shared menu data in `ui_kits/menu-data.js` (`window.RPM_MENU`).
- **Mobile Menu** (`ui_kits/mobile_menu/`) — customer phone menu: search + category jump.
- **TV Board** (`ui_kits/tv_board/`) — auto-rotating big-screen menu board.
- **CMS / Menu Manager** (`ui_kits/cms/`) — the minimal admin: edit items, toggle availability, publish.

## Foundations & specimen cards
`cards/` holds the Design System tab specimens — Colors (Accents, Surfaces, Text), Type (Display, Item Title, Body, Scale), Spacing (Scale, Radii & Borders), Brand (Wordmark, Price Treatment, Leader Row).

## File index
- `styles.css` — entry point; `@import`s all tokens (consumers link this).
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`.
- `components/menu/`, `components/core/` — primitives.
- `ui_kits/mobile_menu/`, `ui_kits/tv_board/`, `ui_kits/cms/` — product surfaces.
- `cards/` — foundation specimen cards.
- `SKILL.md` — Agent-Skill wrapper.
- `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` — auto-generated; never hand-edit.

## Caveats / substitutions
- **Fonts are Google Fonts substitutes** (Anton, Oswald, Zilla Slab, Bungee) chosen to match the printed board's hand-lettered/slab feel. No original font files were supplied — swap for licensed originals if available.
- **No logo file** was provided; the RPM wordmark is type-set. **The Rat Fink-style monster illustration was not provided** and is intentionally not reproduced.
- **No product imagery / photography** was supplied. Surfaces are type-and-color only; add warm, gritty food photos when available.
- All menu copy & prices are transcribed from a single photo; verify against the current live menu before publishing.
