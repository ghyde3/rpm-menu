"use client";

// The shared dark rail-nav shell (per RPM Pub Design System/ui_kits/cms
// visual reference: top bar + left rail). Feature units render their own
// page content inside src/app/admin/layout.tsx's children — they never edit
// this component or the nav item list (src/components/nav/admin-nav.ts).
//
// The rail collapses to an icon-only strip via the toggle at its top; the
// collapsed/expanded choice persists in localStorage. The signed-in account
// + sign-out live pinned to the bottom of the rail (a footer), separated
// from the nav list at the top.
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeft, LogOut } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "./admin-nav";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ds";

export interface AdminRailProps {
  userName: string;
  userEmail: string;
  userRole: string;
  children: React.ReactNode;
}

// Persists the desktop collapsed/expanded choice across reloads. Backed by a
// tiny external store so the read is hydration-safe (server renders expanded,
// the client re-reads localStorage after hydration) without a setState-in-
// effect.
const COLLAPSE_STORAGE_KEY = "rpm-admin-rail-collapsed";

const collapseListeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeCollapsed(cb: () => void): () => void {
  collapseListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === COLLAPSE_STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    collapseListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function setCollapsedPersisted(next: boolean) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
  } catch {
    /* ignore persistence failures (private mode) */
  }
  collapseListeners.forEach((cb) => cb());
}

// Below this viewport width the rail nav collapses behind a hamburger/
// drawer so main content can take the full width (mobile QA finding: at
// phone width the fixed 240px rail left only ~135px of a 375px viewport for
// content, clipping headings and overlapping controls). The desktop
// icon-only collapse is disabled at this width — the drawer is always the
// full rail.
const MOBILE_BREAKPOINT = 720;

const RESPONSIVE_CSS = `
  .admin-rail-hamburger { display: none; }
  .admin-rail-backdrop { display: none; }

  .admin-rail-toggle-wrap { display: flex; }
  .admin-rail-nav { width: 240px; }
  .admin-rail-nav[data-hydrated="true"] { transition: width var(--dur) var(--ease); }
  .admin-rail-nav[data-collapsed="true"] { width: 64px; padding-left: var(--sp-2); padding-right: var(--sp-2); }
  .admin-rail-nav[data-collapsed="true"] .admin-rail-label { display: none; }
  .admin-rail-nav[data-collapsed="true"] .admin-rail-item,
  .admin-rail-nav[data-collapsed="true"] .admin-rail-account,
  .admin-rail-nav[data-collapsed="true"] .admin-rail-signout { justify-content: center; padding-left: 0; padding-right: 0; }

  .admin-rail-item:focus-visible,
  .admin-rail-toggle:focus-visible,
  .admin-rail-signout:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    .admin-rail-hamburger { display: inline-flex; }
    .admin-rail-toggle-wrap { display: none; }
    .admin-rail-nav,
    .admin-rail-nav[data-collapsed="true"] {
      width: 240px;
      padding-left: var(--sp-3);
      padding-right: var(--sp-3);
      position: fixed;
      top: 68px;
      left: 0;
      bottom: 0;
      z-index: 40;
      transform: translateX(-100%);
      transition: transform var(--dur) var(--ease);
      box-shadow: 4px 0 16px rgba(0, 0, 0, 0.5);
    }
    .admin-rail-nav[data-open="true"] {
      transform: translateX(0);
    }
    .admin-rail-nav[data-collapsed="true"] .admin-rail-label { display: block; }
    .admin-rail-nav[data-collapsed="true"] .admin-rail-item,
    .admin-rail-nav[data-collapsed="true"] .admin-rail-account,
    .admin-rail-nav[data-collapsed="true"] .admin-rail-signout { justify-content: flex-start; }
    .admin-rail-backdrop[data-open="true"] {
      display: block;
      position: fixed;
      top: 68px;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 30;
    }
  }
`;

export function AdminRail({ userName, userEmail, userRole, children }: AdminRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);

  // Read persisted collapse state via an external store: `false` on the
  // server and first client render (matching SSR), re-read from localStorage
  // after hydration. Avoids both a hydration mismatch and a setState-in-effect.
  const collapsed = React.useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const hydrated = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const toggleCollapsed = () => setCollapsedPersisted(!collapsed);

  // Close the mobile drawer whenever the route changes (link click, back
  // button, etc.) so it never stays open over a new page.
  const [prevPathname, setPrevPathname] = React.useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--surface-base)" }}>
      <style>{RESPONSIVE_CSS}</style>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--sp-6)",
          height: 68,
          borderBottom: "var(--bw) solid var(--border-hairline)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <button
            type="button"
            className="admin-rail-hamburger"
            onClick={() => setNavOpen((v) => !v)}
            aria-label={navOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={navOpen}
            aria-controls="admin-rail-nav"
            style={{
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
              width: "var(--tap-target)",
              height: "var(--tap-target)",
              background: "transparent",
              border: "var(--bw) solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span style={{ display: "block", width: 18, height: 2, margin: "0 auto", background: "var(--text-primary)" }} />
            <span style={{ display: "block", width: 18, height: 2, margin: "0 auto", background: "var(--text-primary)" }} />
            <span style={{ display: "block", width: 18, height: 2, margin: "0 auto", background: "var(--text-primary)" }} />
          </button>
          <span style={{ fontFamily: "var(--font-accent)", fontSize: 26, color: "var(--rpm-cream)" }}>
            <span style={{ color: "var(--accent-primary)" }}>R</span>PM
          </span>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-wide)",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            Menu Manager
          </span>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div className="admin-rail-backdrop" data-open={navOpen} onClick={() => setNavOpen(false)} />
        <nav
          id="admin-rail-nav"
          className="admin-rail-nav"
          aria-label="Primary"
          data-open={navOpen}
          data-collapsed={collapsed}
          data-hydrated={hydrated}
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: "var(--bw) solid var(--border-hairline)",
            padding: "var(--sp-3)",
            background: "var(--surface-raised)",
          }}
        >
          {/* Collapse toggle (desktop only — hidden at mobile width) */}
          <div
            className="admin-rail-toggle-wrap"
            style={{ justifyContent: collapsed ? "center" : "flex-end", marginBottom: "var(--sp-2)" }}
          >
            <button
              type="button"
              className="admin-rail-toggle"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls="admin-rail-nav"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                color: "var(--text-secondary)",
                background: "transparent",
                border: "var(--bw) solid transparent",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          {/* Nav list (top) */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {ADMIN_NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="admin-rail-item"
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                    padding: "10px var(--sp-3)",
                    marginBottom: 2,
                    borderRadius: "var(--radius-sm)",
                    borderLeft: "3px solid " + (active ? "var(--accent-primary)" : "transparent"),
                    background: active ? "var(--surface-inset)" : "transparent",
                    fontFamily: "var(--font-heading)",
                    fontSize: 14,
                    fontWeight: 500,
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  <Icon size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
                  <span className="admin-rail-label" style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Account + sign out (pinned bottom) */}
          <div
            style={{
              marginTop: "var(--sp-3)",
              paddingTop: "var(--sp-3)",
              borderTop: "var(--bw) solid var(--border-hairline)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-2)",
            }}
          >
            <div
              className="admin-rail-account"
              title={userName + " · " + userRole}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-3)",
                padding: "var(--sp-1) var(--sp-2)",
                minWidth: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-pill)",
                  background: "var(--surface-inset)",
                  border: "var(--bw) solid var(--border-strong)",
                  fontFamily: "var(--font-heading)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {initial}
              </span>
              <span className="admin-rail-label" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {userName}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {userEmail} · {userRole}
                </span>
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              fullWidth
              className="admin-rail-signout"
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
              <span className="admin-rail-label">Sign Out</span>
            </Button>
          </div>
        </nav>

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "var(--sp-6) var(--sp-7)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
