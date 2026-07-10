// Settings > Menu Behavior (§3.8). Owned by the settings-branding-menu-
// behavior unit (M2); the qr/ sub-route is reserved for the M3
// settings-api-keys-data-recovery-sessions-qr unit per plan owns_paths.
import type { CSSProperties } from "react";
import Link from "next/link";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { getMenuBehaviorSettings } from "@/lib/service/settings/menu-behavior";
import { Card } from "@/components/ds";
import { MenuBehaviorSettingsForm } from "./MenuBehaviorSettingsForm";

function pageTitleStyle(): CSSProperties {
  return {
    fontFamily: "var(--font-display)",
    textTransform: "uppercase",
    color: "var(--accent-primary)",
    fontSize: "var(--fs-h3)",
    margin: 0,
  };
}

function OwnerOnlyNotice() {
  return (
    <div>
      <h1 style={pageTitleStyle()}>Settings · Menu Behavior</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            Menu Behavior settings are owner-only (§3.8). Ask an owner to make changes here.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default async function MenuBehaviorSettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return <OwnerOnlyNotice />;
  }

  const settings = await getMenuBehaviorSettings(db);

  return (
    <div>
      <h1 style={pageTitleStyle()}>Settings · Menu Behavior</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <MenuBehaviorSettingsForm initialSettings={settings} />
      </div>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-primary)" }}>
              QR Code for the Public Menu
            </div>
            <p style={{ margin: "var(--sp-1) 0 0", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
              Download a printable SVG/PNG QR code that links to <code>/menu</code> (§3.8).
            </p>
          </div>
          <Link
            href="/admin/settings/qr"
            style={{
              fontFamily: "var(--font-heading)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
              fontSize: "0.8125rem",
              color: "var(--accent-primary)",
              whiteSpace: "nowrap",
            }}
          >
            Open QR Generator →
          </Link>
        </Card>
      </div>
    </div>
  );
}
