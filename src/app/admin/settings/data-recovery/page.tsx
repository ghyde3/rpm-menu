// Settings > Data & Recovery (§3.8). Owned by the
// settings-api-keys-data-recovery-sessions-qr unit (M3).
import type { CSSProperties } from "react";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { getBackupStatus } from "@/lib/service/settings/data-recovery";
import { Card } from "@/components/ds";
import { DataRecoveryPanel } from "./DataRecoveryPanel";

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
      <h1 style={pageTitleStyle()}>Settings · Data &amp; Recovery</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            Data &amp; Recovery is owner-only (§3.8). Ask an owner to make changes here.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default async function DataRecoverySettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return <OwnerOnlyNotice />;
  }

  const caller = {
    actor: { type: "user" as const, id: session.user.id },
    surface: "admin_ui" as const,
    role: session.user.role,
    isActive: session.user.isActive,
  };
  const backupStatus = await getBackupStatus(db, caller);

  return (
    <div>
      <h1 style={pageTitleStyle()}>Settings · Data &amp; Recovery</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <DataRecoveryPanel backupStatus={backupStatus} />
      </div>
    </div>
  );
}
