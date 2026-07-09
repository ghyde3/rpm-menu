---
name: rpm-pub-design
description: Use this skill to generate well-branded interfaces and assets for RPM Full Service Patio Pub & Grill (Newnan, GA dive/biker-bar gastropub), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components (menu CMS, mobile menu, TV board) for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation
- **Brand:** dive bar / biker / kustom-kulture. Distressed black chalkboard, hot-rod red + flame-orange lettering, beer-amber prices, dotted leader lines. Flat, hard-edged, matte. No emoji.
- **Tokens:** link `styles.css` (it `@import`s everything under `tokens/`). Key colors: `--accent-primary` (red), `--accent-secondary` (orange), `--accent-price` (amber), `--accent-new` (green); surfaces `--surface-base/raised/inset`; text `--text-primary/secondary/muted`.
- **Type:** Anton (headers), Oswald 700 italic caps (item titles/labels), Zilla Slab (body), Bungee (wordmark only).
- **Components:** compiled to `window.RPMPubDesignSystem_cc2ec6`. Menu: `SectionHeader, MenuItem, MenuSection, PriceTag, Tag`. Core: `Button, Input, Textarea, Switch, Card`. Load `_ds_bundle.js` and read from the namespace; do not `<script src>` the `.jsx`.
- **Surfaces:** `ui_kits/mobile_menu` (customer phone), `ui_kits/tv_board` (big screen), `ui_kits/cms` (Menu Manager admin). Shared data: `ui_kits/menu-data.js` → `window.RPM_MENU`.

## Signature moves
- Prices: big dollars, small superscript cents (12⁹⁹), amber, no `$` on the board.
- Item titles: ALL CAPS Oswald bold italic, flame orange, punny names.
- Dotted `2px` leader from title to price. Square corners. ★ stars flank section headers.
- "86'd" = out; toggle green Switch for availability.

## Caveats
- Fonts are Google Fonts substitutes; no original brand fonts supplied.
- No logo file and no Rat Fink monster illustration were provided — use the type-set wordmark; never fabricate the mark or redraw the art.
