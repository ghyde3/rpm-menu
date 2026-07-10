// The admin rail-nav item list, collapsed to three top-level hubs (Items,
// Displays, Settings). Each hub owns a tabbed sub-nav for what used to be a
// separate top-level entry:
//   - Items    -> Items | Categories | Tags (+ inline bulk ops on the list)
//   - Displays -> Displays | Screens (weekly schedule lives inside Displays)
//   - Settings -> Venue / Branding / … / API Keys / Audit Log
// Old routes (/admin/categories, /admin/tags, /admin/screens, /admin/schedule,
// /admin/changes, /admin/items/bulk, /admin/settings/displays) redirect into
// their new hub location so no link 404s.
import { UtensilsCrossed, MonitorPlay, Settings, type LucideIcon } from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  /** Lucide icon rendered beside the label in the rail (and alone when the
   * rail is collapsed to an icon-only strip). Inherits the same active/
   * inactive token colors as the label via `currentColor`. */
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Items", href: "/admin/items", icon: UtensilsCrossed },
  { label: "Displays", href: "/admin/displays", icon: MonitorPlay },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
