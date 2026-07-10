"use client";

// Settings > Data & Recovery (§3.8): backup status, one-click full JSON
// export, and a cross-link to Recent Changes/revert. Styled with
// design-system tokens/components only.
import * as React from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ds";
import type { BackupStatus } from "@/lib/service/settings/data-recovery";
import { exportFullDataAction } from "./actions";

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  fontSize: "0.9375rem",
  color: "var(--text-primary)",
  margin: "0 0 var(--sp-4) 0",
};

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataRecoveryPanel({ backupStatus }: { backupStatus: BackupStatus }) {
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleExport() {
    setError(null);
    setExporting(true);
    const result = await exportFullDataAction();
    setExporting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    downloadJson(result.data.filename, result.data.json);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <Card>
        <h2 style={sectionTitleStyle}>Backup Status</h2>
        {backupStatus.source === "env" && backupStatus.lastSuccessfulBackupAt ? (
          <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            Last successful backup:{" "}
            <strong>{backupStatus.lastSuccessfulBackupAt.toLocaleString()}</strong>
          </p>
        ) : (
          <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: "0.9375rem" }}>
            No backup signal is configured yet. Daily automated Postgres backups (§3.6) are a hosting-level
            concern — once a backup job runs, point it at setting the <code>BACKUP_LAST_SUCCESS_AT</code>{" "}
            environment variable (ISO-8601 timestamp) on each successful run so this status reflects reality.
          </p>
        )}
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Full Export</h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
          Downloads a JSON dump of the menu (categories, items, tags, modifiers), screens, displays, and venue
          settings — your data, portable at any time, and a migration/insurance backstop independent of the
          hosting provider&apos;s own backups.
        </p>
        <div style={{ marginTop: "var(--sp-4)" }}>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? "Preparing export…" : "Download Full Export (JSON)"}
          </Button>
        </div>
        {error && (
          <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
            {error}
          </p>
        )}
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Recent Changes &amp; Revert</h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
          Every mutation is audited with a one-click revert (§3.5). The full feed lives under Settings › Audit Log,
          not here.
        </p>
        <div style={{ marginTop: "var(--sp-4)" }}>
          <Link href="/admin/settings/audit-log">
            <Button variant="secondary">Open Audit Log</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
