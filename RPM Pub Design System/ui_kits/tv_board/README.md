# TV Board — Big-Screen Display

Fixed 1920×1080 menu board that auto-scales to any screen. Meant for the wall-mounted TV over the bar.

**Behavior**
- `TVBoard.jsx` — masthead (RPM wordmark, "15 on tap", location), an auto-rotating body, and a red footer ticker ("Live Music · Open Mic · Pet Friendly Patio").
- Two board pages rotate every 9s: (1) Sandwiches in two columns, (2) Salads / Desserts / On Tap side-by-side. Click the page dots to jump and pause rotation.
- Prices use `priceSize="lg"` for across-the-room legibility.

**Composes:** `SectionHeader`, `MenuItem` (→ `PriceTag`, `Tag`).
**Data:** `window.RPM_MENU` from `ui_kits/menu-data.js`.
