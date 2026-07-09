"use client";

// Settings > Users (§3.8): invite staff by email, assign role, deactivate/
// reactivate, force password reset, at-least-one-active-owner enforcement
// (server-side — this component just surfaces whatever the service layer
// decides). Styled with design-system tokens/components only.
import * as React from "react";
import { Button, Card, Input } from "@/components/ds";
import type { Role } from "@/db/schema";
import type { SafeUser } from "@/lib/service/users";
import {
  inviteUserAction,
  updateUserRoleAction,
  setUserActiveAction,
  forcePasswordResetAction,
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

const selectStyle: React.CSSProperties = {
  background: "var(--surface-inset)",
  border: "var(--bw) solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  padding: "6px var(--sp-2)",
};

export function UsersTable({ initialUsers, currentUserId }: { initialUsers: SafeUser[]; currentUserId: string }) {
  const [users, setUsers] = React.useState(initialUsers);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Role>("staff");
  const [inviting, setInviting] = React.useState(false);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = React.useState<{ email: string; password: string } | null>(
    null,
  );

  function upsertUser(user: SafeUser) {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id);
      if (idx === -1) return [...prev, user];
      const next = [...prev];
      next[idx] = user;
      return next;
    });
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    const result = await inviteUserAction({ email: inviteEmail, name: inviteName, role: inviteRole });
    setInviting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    upsertUser(result.data.user);
    setRevealedPassword({ email: result.data.user.email, password: result.data.temporaryPassword });
    setInviteEmail("");
    setInviteName("");
    setInviteRole("staff");
  }

  async function handleRoleChange(userId: string, role: Role) {
    setError(null);
    setBusyUserId(userId);
    const result = await updateUserRoleAction(userId, role);
    setBusyUserId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    upsertUser(result.data);
  }

  async function handleToggleActive(user: SafeUser) {
    setError(null);
    setBusyUserId(user.id);
    const result = await setUserActiveAction(user.id, !user.isActive);
    setBusyUserId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    upsertUser(result.data);
  }

  async function handleForceReset(user: SafeUser) {
    setError(null);
    setBusyUserId(user.id);
    const result = await forcePasswordResetAction(user.id);
    setBusyUserId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRevealedPassword({ email: user.email, password: result.data.temporaryPassword });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <Card>
        <h2 style={sectionTitleStyle}>Invite Staff</h2>
        <form
          onSubmit={handleInvite}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: "var(--sp-3)", alignItems: "end" }}
        >
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <Input label="Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            <label
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "var(--ls-caps)",
                color: "var(--text-muted)",
              }}
            >
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              style={{ ...selectStyle, height: 44 }}
            >
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting ? "Inviting…" : "Invite"}
          </Button>
        </form>
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
          No email-sending is wired up yet — a one-time temporary password is shown after inviting; relay it to
          the new staff member yourself.
        </p>
      </Card>

      {error && (
        <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
          {error}
        </p>
      )}

      <Card padded={false}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const busy = busyUserId === user.id;
                return (
                  <tr key={user.id}>
                    <td style={tdStyle}>
                      {user.name}
                      {user.id === currentUserId && (
                        <span style={{ color: "var(--text-faint)" }}> (you)</span>
                      )}
                    </td>
                    <td style={tdStyle}>{user.email}</td>
                    <td style={tdStyle}>
                      <select
                        value={user.role}
                        disabled={busy}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        style={selectStyle}
                      >
                        <option value="staff">Staff</option>
                        <option value="owner">Owner</option>
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: user.isActive ? "var(--accent-new, #6fbf73)" : "var(--text-faint)" }}>
                        {user.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                        <Button
                          size="sm"
                          variant={user.isActive ? "danger" : "secondary"}
                          disabled={busy}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleForceReset(user)}>
                          Force Password Reset
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {revealedPassword && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div style={{ width: "100%", maxWidth: 460 }}>
            <Card accent>
              <h2 style={sectionTitleStyle}>Temporary Password</h2>
              <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
                Shown once for <strong>{revealedPassword.email}</strong> — relay it to them now. It will not be
                shown again.
              </p>
              <Input readOnly value={revealedPassword.password} onFocus={(e) => e.currentTarget.select()} />
              <div style={{ marginTop: "var(--sp-4)" }}>
                <Button onClick={() => setRevealedPassword(null)}>Done</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
