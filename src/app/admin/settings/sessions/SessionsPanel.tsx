"use client";

// Settings > Sessions & Security (§3.8): active sessions list with revoke/
// sign-out-everywhere, owner password change, optional TOTP 2FA. Styled
// with design-system tokens/components only.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ds";
import type { SafeSession, TotpStatus } from "@/lib/service/settings/sessions";
import {
  revokeSessionAction,
  signOutEverywhereAction,
  changeMyPasswordAction,
  startTotpEnrollmentAction,
  confirmTotpEnrollmentAction,
  disableTotpAction,
} from "./actions";

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  fontSize: "0.9375rem",
  color: "var(--text-primary)",
  margin: "0 0 var(--sp-4) 0",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
  padding: "var(--sp-2) var(--sp-3)",
  borderBottom: "var(--bw) solid var(--border-hairline)",
};

const tdStyle: React.CSSProperties = {
  padding: "var(--sp-3)",
  borderBottom: "var(--bw) solid var(--border-hairline)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  color: "var(--text-secondary)",
};

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString();
}

// --- Sessions list -----------------------------------------------------

function SessionsList({ initialSessions }: { initialSessions: SafeSession[] }) {
  const router = useRouter();
  const [sessionList, setSessionList] = React.useState(initialSessions);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRevoke(session: SafeSession) {
    setError(null);
    setBusyId(session.id);
    const result = await revokeSessionAction(session.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSessionList((prev) => prev.filter((s) => s.id !== session.id));
  }

  async function handleSignOutEverywhere() {
    setError(null);
    setSigningOutAll(true);
    const result = await signOutEverywhereAction();
    setSigningOutAll(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/login");
  }

  return (
    <Card>
      <h2 style={sectionTitleStyle}>Active Sessions</h2>
      {error && (
        <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
          {error}
        </p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Device / Agent</th>
              <th style={thStyle}>IP</th>
              <th style={thStyle}>Signed In</th>
              <th style={thStyle}>Expires</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessionList.map((session) => (
              <tr key={session.id}>
                <td style={tdStyle}>
                  {session.userAgent ?? "Unknown"}
                  {session.isCurrent && <span style={{ color: "var(--text-faint)" }}> (this device)</span>}
                </td>
                <td style={tdStyle}>{session.ipAddress ?? "—"}</td>
                <td style={tdStyle}>{formatDate(session.createdAt)}</td>
                <td style={tdStyle}>{formatDate(session.expiresAt)}</td>
                <td style={tdStyle}>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyId === session.id}
                    onClick={() => handleRevoke(session)}
                  >
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: "var(--sp-4)" }}>
        <Button variant="danger" disabled={signingOutAll} onClick={handleSignOutEverywhere}>
          {signingOutAll ? "Signing out…" : "Sign Out Everywhere"}
        </Button>
      </div>
    </Card>
  );
}

// --- Password change -----------------------------------------------------

function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    const result = await changeMyPasswordAction({ currentPassword, newPassword });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDone(true);
  }

  return (
    <Card>
      <h2 style={sectionTitleStyle}>Change Password</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <Input
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <Input
          label="New Password"
          type="password"
          hint="At least 8 characters."
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {error && (
          <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
            {error}
          </p>
        )}
        {done && (
          <p style={{ color: "var(--accent-new, #6fbf73)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
            Password changed. All sessions (including this one) were signed out.
          </p>
        )}
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Changing…" : "Change Password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// --- TOTP 2FA -----------------------------------------------------------

type TotpFlowState =
  | { step: "idle" }
  | { step: "enrolling"; secret: string; otpauthUri: string; qrDataUrl: string }
  | { step: "backup-codes"; codes: string[] };

function TotpPanel({ initialStatus }: { initialStatus: TotpStatus }) {
  const [status, setStatus] = React.useState(initialStatus);
  const [flow, setFlow] = React.useState<TotpFlowState>({ step: "idle" });
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleStartEnrollment() {
    setError(null);
    setBusy(true);
    const result = await startTotpEnrollmentAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlow({ step: "enrolling", ...result.data });
    setStatus({ enabled: false, pending: true });
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await confirmTotpEnrollmentAction(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlow({ step: "backup-codes", codes: result.data.backupCodes });
    setStatus({ enabled: true, pending: false });
    setCode("");
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await disableTotpAction(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus({ enabled: false, pending: false });
    setFlow({ step: "idle" });
    setCode("");
  }

  return (
    <Card>
      <h2 style={sectionTitleStyle}>Two-Factor Authentication (TOTP)</h2>
      <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
        Optional, recommended for the owner account — the one account that can change prices.
      </p>

      {error && (
        <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
          {error}
        </p>
      )}

      {flow.step === "idle" && status.enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <p style={{ color: "var(--accent-new, #6fbf73)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
            2FA is enabled.
          </p>
          <form onSubmit={handleDisable} style={{ display: "flex", gap: "var(--sp-3)", alignItems: "end" }}>
            <Input
              label="Code to disable"
              hint="Enter a current 6-digit code or a backup code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? "Disabling…" : "Disable 2FA"}
            </Button>
          </form>
        </div>
      )}

      {flow.step === "idle" && !status.enabled && (
        <Button onClick={handleStartEnrollment} disabled={busy}>
          {busy ? "Starting…" : "Enable 2FA"}
        </Button>
      )}

      {flow.step === "enrolling" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, ...), or enter
            the secret manually.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flow.qrDataUrl}
            alt="TOTP QR code"
            width={200}
            height={200}
            style={{ background: "#fff", padding: 8, borderRadius: "var(--radius-sm)" }}
          />
          <Input readOnly label="Secret (manual entry)" value={flow.secret} onFocus={(e) => e.currentTarget.select()} />
          <form onSubmit={handleConfirm} style={{ display: "flex", gap: "var(--sp-3)", alignItems: "end" }}>
            <Input
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Confirming…" : "Confirm & Enable"}
            </Button>
          </form>
        </div>
      )}

      {flow.step === "backup-codes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <p style={{ color: "var(--accent-new, #6fbf73)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
            2FA enabled. Save these backup codes somewhere safe — each works once, shown only now.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "var(--sp-2)",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.9375rem",
              color: "var(--text-primary)",
              background: "var(--surface-inset)",
              padding: "var(--sp-4)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {flow.codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div>
            <Button onClick={() => setFlow({ step: "idle" })}>Done</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function SessionsPanel({
  initialSessions,
  initialTotpStatus,
}: {
  initialSessions: SafeSession[];
  initialTotpStatus: TotpStatus;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <SessionsList initialSessions={initialSessions} />
      <PasswordChangeForm />
      <TotpPanel initialStatus={initialTotpStatus} />
    </div>
  );
}
