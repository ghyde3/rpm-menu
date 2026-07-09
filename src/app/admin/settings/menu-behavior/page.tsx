// Settings > Menu Behavior (§3.8). Owned by the settings-branding-menu-
// behavior unit (M2); the qr/ sub-route is reserved for the M3
// settings-api-keys-data-recovery-sessions-qr unit per plan owns_paths.
import type { CSSProperties } from "react";
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
    </div>
  );
}
