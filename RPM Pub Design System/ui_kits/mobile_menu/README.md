# Mobile Menu — Customer View

Phone-sized (430×760) customer-facing menu for RPM. What a guest sees when they scan the QR code on the table.

**Screens / behavior**
- `MobileMenu.jsx` — sticky header (RPM wordmark + search), horizontal category chips that smooth-scroll to sections, and the full board rendered from `../menu-data.js` using the `SectionHeader` + `MenuItem` primitives.
- Search filters items live by name/description across all categories.
- 86'd items render dimmed + struck through automatically via `MenuItem available={false}`.

**Composes:** `SectionHeader`, `MenuItem` (→ `PriceTag`, `Tag`).

**Data:** `window.RPM_MENU` from `ui_kits/menu-data.js`.
