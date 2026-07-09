"use client";

// The shared dark rail-nav shell (per RPM Pub Design System/ui_kits/cms
// visual reference: top bar + left rail). Feature units render their own
// page content inside src/app/admin/layout.tsx's children — they never edit
// this component or the nav item list (src/components/nav/admin-nav.ts).
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "./admin-nav";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ds";

export interface AdminRailProps {
  userName: string;
  userRole: string;
  children: React.ReactNode;
}

export function AdminRail({ userName, userRole, children }: AdminRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--surface-base)" }}>
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
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 13,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
            }}
          >
            {userName} · {userRole}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut}>
            Sign Out
          </Button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <nav
          style={{
            width: 240,
            flexShrink: 0,
            borderRight: "var(--bw) solid var(--border-hairline)",
            padding: "var(--sp-4) var(--sp-3)",
            overflowY: "auto",
            background: "var(--surface-raised)",
          }}
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "block",
                  padding: "10px var(--sp-3)",
                  marginBottom: 2,
                  borderRadius: "var(--radius-sm)",
                  borderLeft: "3px solid " + (active ? "var(--accent-primary)" : "transparent"),
                  background: active ? "var(--surface-inset)" : "transparent",
                  fontFamily: "var(--font-heading)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "var(--sp-6) var(--sp-7)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
