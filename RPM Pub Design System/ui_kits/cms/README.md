# CMS — Menu Manager (Admin)

The minimal back-office for Kelly & Joe to run the RPM board. Desktop layout (1280×760).

**Behavior**
- `CmsApp.jsx` — three panes: category rail (with live/total counts), item list, and a slide-in editor drawer.
- Toggle any item's availability inline (the green `Switch` = "on the board", off = "86'd").
- Edit or add items in the drawer: name, price ($ prefix), description, attribute tags, availability, Save / Delete.
- Editing anything flips status to **Unpublished changes**; "Publish to Board" pushes the menu live (mock).

**Composes:** `Button`, `Input`, `Textarea`, `Switch`, `Card`, `Tag`, `PriceTag`.
**Data:** seeded from `window.RPM_MENU` (`ui_kits/menu-data.js`), then edited in local React state.
