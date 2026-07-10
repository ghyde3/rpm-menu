"use client";

// Shared sub-nav tab bar rendered at the top of a hub (Items, Displays). Each
// hub passes its own tab list; the active tab is derived from the current
// pathname (exact match, or a prefix match for the hub's index tab so deep
// sub-routes like /admin/items/categories/[id] keep the right tab lit).
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface HubTab {
  label: string;
  href: string;
  /** When true, this tab is active for any path under `href` (used for the
   * hub index tab, which owns the widest prefix). Non-index tabs match by
   * their own prefix and win over the index tab because they are more
   * specific. */
  index?: boolean;
}

export interface HubTabsProps {
  tabs: HubTab[];
}

export function HubTabs({ tabs }: HubTabsProps) {
  const pathname = usePathname();

  // A tab is active when the pathname is under its href. The most specific
  // (longest) matching href wins, so /admin/items/categories lights the
  // Categories tab, not the Items index tab.
  let activeHref = "";
  for (const tab of tabs) {
    const matches = pathname === tab.href || pathname.startsWith(tab.href + "/");
    if (matches && tab.href.length > activeHref.length) activeHref = tab.href;
  }

  return (
    <nav
      style={{
        display: "flex",
        gap: "var(--sp-1)",
        flexWrap: "wrap",
        borderBottom: "var(--bw) solid var(--border-hairline)",
        marginBottom: "var(--sp-5)",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "var(--sp-2) var(--sp-4)",
              marginBottom: -1,
              borderBottom: "2px solid " + (active ? "var(--accent-primary)" : "transparent"),
              fontFamily: "var(--font-heading)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const ITEMS_HUB_TABS: HubTab[] = [
  { label: "Items", href: "/admin/items", index: true },
  { label: "Categories", href: "/admin/items/categories" },
  { label: "Tags", href: "/admin/items/tags" },
];

export const DISPLAYS_HUB_TABS: HubTab[] = [
  { label: "Displays", href: "/admin/displays", index: true },
  { label: "Screens", href: "/admin/displays/screens" },
];
