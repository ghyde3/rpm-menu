// Settings > API Keys (§3.7's management UI + §3.8). Owned by the
// settings-api-keys-data-recovery-sessions-qr unit (M3).
import type { CSSProperties } from "react";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { listApiKeys } from "@/lib/service/settings/api-keys";
import { Card } from "@/components/ds";
import { ApiKeysTable } from "./ApiKeysTable";

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
      <h1 style={pageTitleStyle()}>Settings · API Keys</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            API key management is owner-only (§3.8). Ask an owner to make changes here.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default async function ApiKeysSettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return <OwnerOnlyNotice />;
  }

  const keys = await listApiKeys(db, {
    actor: { type: "user", id: session.user.id },
    surface: "admin_ui",
    role: session.user.role,
    isActive: session.user.isActive,
  });

  return (
    <div>
      <h1 style={pageTitleStyle()}>Settings · API Keys</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <ApiKeysTable initialKeys={keys} />
      </div>
    </div>
  );
}
