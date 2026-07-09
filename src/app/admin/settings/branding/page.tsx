// Settings > Branding (§3.8). Owned by the settings-branding-menu-behavior
// unit (M2).
import type { CSSProperties } from "react";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { getBrandingSettings } from "@/lib/service/settings/branding";
import { getImage } from "@/lib/service/images";
import { Card } from "@/components/ds";
import { BrandingSettingsForm } from "./BrandingSettingsForm";

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
      <h1 style={pageTitleStyle()}>Settings · Branding</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            Branding settings are owner-only (§3.8). Ask an owner to make changes here.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default async function BrandingSettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return <OwnerOnlyNotice />;
  }

  const settings = await getBrandingSettings(db);
  const logoImage = settings.logoImageId ? await getImage(db, settings.logoImageId).catch(() => null) : null;

  return (
    <div>
      <h1 style={pageTitleStyle()}>Settings · Branding</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <BrandingSettingsForm initialSettings={settings} initialLogoImage={logoImage} />
      </div>
    </div>
  );
}
