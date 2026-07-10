// The complete, pre-registered admin rail-nav. Every entry maps to a real
// route (a placeholder page.tsx today; feature units fill in the page
// content, they never edit this list or src/app/admin/layout.tsx). Adding a
// nav entry later is a foundation-owned change, not a feature-unit change.
export interface AdminNavItem {
  label: string;
  href: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Items", href: "/admin/items" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Tags", href: "/admin/tags" },
  { label: "Screens", href: "/admin/screens" },
  { label: "Displays", href: "/admin/settings/displays" },
  { label: "Schedule", href: "/admin/schedule" },
  { label: "Audit Log", href: "/admin/changes" },
  { label: "Bulk Ops", href: "/admin/items/bulk" },
  { label: "Settings", href: "/admin/settings" },
  { label: "API Keys", href: "/admin/settings/api-keys" },
];
