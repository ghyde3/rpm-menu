"use client";

// Settings > API Keys (§3.7/§3.8): create (name + scope checkboxes, secret
// shown once), list (scopes, created, last-used), revoke. Styled with
// design-system tokens/components only.
import * as React from "react";
import { Button, Card, Input } from "@/components/ds";
import { API_KEY_SCOPES, type ApiKeyScope } from "@/db/schema";
import type { SafeApiKey } from "@/lib/service/settings/api-keys";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

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

const scopeLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-2)",
  fontFamily: "var(--font-body)",
  fontSize: "0.8125rem",
  color: "var(--text-secondary)",
};

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString();
}

export function ApiKeysTable({ initialKeys }: { initialKeys: SafeApiKey[] }) {
  const [keys, setKeys] = React.useState(initialKeys);
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<ApiKeyScope[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [revealedKey, setRevealedKey] = React.useState<{ name: string; plaintext: string } | null>(null);

  function upsertKey(key: SafeApiKey) {
    setKeys((prev) => {
      const idx = prev.findIndex((k) => k.id === key.id);
      if (idx === -1) return [key, ...prev];
      const next = [...prev];
      next[idx] = key;
      return next;
    });
  }

  function toggleScope(scope: ApiKeyScope) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const result = await createApiKeyAction({ name, scopes });
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    upsertKey(result.data.apiKey);
    setRevealedKey({ name: result.data.apiKey.name, plaintext: result.data.plaintextKey });
    setName("");
    setScopes([]);
  }

  async function handleRevoke(key: SafeApiKey) {
    setError(null);
    setBusyId(key.id);
    const result = await revokeApiKeyAction(key.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    upsertKey(result.data);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <Card>
        <h2 style={sectionTitleStyle}>Create API Key</h2>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Input
            label="Name"
            placeholder='e.g. "menu-bot" or "Claude MCP connector"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
              Scopes
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
              {API_KEY_SCOPES.map((scope) => (
                <label key={scope} style={scopeLabelStyle}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                  />
                  {scope}
                </label>
              ))}
            </div>
            <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.75rem", margin: 0 }}>
              No settings-write scope exists in Phase 1 (§3.8) — API keys can never change timezone, users, or
              branding.
            </p>
          </div>
          <div>
            <Button type="submit" disabled={creating || !name || scopes.length === 0}>
              {creating ? "Creating…" : "Create Key"}
            </Button>
          </div>
        </form>
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
                <th style={thStyle}>Scopes</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Last Used</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan={6}>
                    No API keys yet.
                  </td>
                </tr>
              )}
              {keys.map((key) => {
                const busy = busyId === key.id;
                const revoked = Boolean(key.revokedAt);
                return (
                  <tr key={key.id}>
                    <td style={tdStyle}>{key.name}</td>
                    <td style={tdStyle}>{key.scopes.join(", ")}</td>
                    <td style={tdStyle}>{formatDate(key.createdAt)}</td>
                    <td style={tdStyle}>{formatDate(key.lastUsedAt)}</td>
                    <td style={tdStyle}>
                      <span style={{ color: revoked ? "var(--text-faint)" : "var(--accent-new, #6fbf73)" }}>
                        {revoked ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy || revoked}
                        onClick={() => handleRevoke(key)}
                      >
                        {revoked ? "Revoked" : "Revoke"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {revealedKey && (
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
          <div style={{ width: "100%", maxWidth: 520 }}>
            <Card accent>
              <h2 style={sectionTitleStyle}>API Key Created</h2>
              <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
                Shown once for <strong>{revealedKey.name}</strong> — copy it now. It cannot be retrieved again;
                revoke and create a new key if it&apos;s lost.
              </p>
              <Input readOnly value={revealedKey.plaintext} onFocus={(e) => e.currentTarget.select()} />
              <div style={{ marginTop: "var(--sp-4)" }}>
                <Button onClick={() => setRevealedKey(null)}>Done</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
