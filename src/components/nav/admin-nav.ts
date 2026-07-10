// The admin rail-nav item list, collapsed to three top-level hubs (Items,
// Displays, Settings). Each hub owns a tabbed sub-nav for what used to be a
// separate top-level entry:
//   - Items    -> Items | Categories | Tags (+ inline bulk ops on the list)
//   - Displays -> Displays | Screens (weekly schedule lives inside Displays)
//   - Settings -> Venue / Branding / … / API Keys / Audit Log
// Old routes (/admin/categories, /admin/tags, /admin/screens, /admin/schedule,
// /admin/changes, /admin/items/bulk, /admin/settings/displays) redirect into
// their new hub location so no link 404s.
export interface AdminNavItem {
  label: string;
  href: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Items", href: "/admin/items" },
  { label: "Displays", href: "/admin/displays" },
  { label: "Settings", href: "/admin/settings" },
];
