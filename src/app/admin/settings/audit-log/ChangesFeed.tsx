"use client";

// The "Recent changes" feed (PRD §3.5), filterable by user/entity, with
// one-click single-entity revert and bulk-group revert. Filtering is
// client-side over an already-fetched page, matching the rest of the admin
// UI's "fetch broad, filter client-side" convention (see ItemsBrowser).
import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ds";
import type { EntityType } from "@/db/schema";
import { revertChangeAction, revertBulkGroupAction } from "./actions";

export interface ChangeEntryDTO {
  id: string;
  actorType: "user" | "display" | "system";
  actorId: string | null;
  actorName: string | null;
  surface: string;
  action: string;
  entityType: EntityType;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  bulkGroup: { changeType: string; pendingChangeId: string } | null;
}

export interface ChangeActorDTO {
  id: string;
  name: string;
}

export interface ChangesFeedProps {
  changes: ChangeEntryDTO[];
  actors: ChangeActorDTO[];
  entityTypes: EntityType[];
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

const selectStyle: React.CSSProperties = {
  height: "var(--tap-target)",
  background: "var(--surface-inset)",
  border: "var(--bw) solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-body)",
  padding: "0 var(--sp-3)",
};

function friendly(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function describeAction(entry: ChangeEntryDTO): string {
  if (entry.bulkGroup) return `${friendly(entry.bulkGroup.changeType)} (bulk)`;
  if (entry.action.startsWith("revert:")) return `Revert: ${friendly(entry.action.slice("revert:".length))}`;
  return friendly(entry.action);
}

/** Distinguishes "system" actor rows by their actual `surface` column
 * (api/mcp/slack/discord/sms) instead of a blanket "System / API" label --
 * the surface is stored per-row precisely so REST vs. MCP vs. other
 * automation origins are visually distinguishable for accountability. */
function describeSurface(surface: string): string {
  switch (surface) {
    case "api":
      return "System / API";
    case "mcp":
      return "System / MCP";
    case "slack":
      return "System / Slack";
    case "discord":
      return "System / Discord";
    case "sms":
      return "System / SMS";
    default:
      return "System";
  }
}

function describeEntity(entry: ChangeEntryDTO): string {
  const before = entry.before as Record<string, unknown> | null;
  const after = entry.after as Record<string, unknown> | null;
  const name = (before && typeof before.name === "string" && before.name) || (after && typeof after.name === "string" && after.name);
  if (name) return name as string;
  return entry.entityId ? `${entry.entityType} ${entry.entityId.slice(0, 8)}` : entry.entityType;
}

function formatVal(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function summarizeChange(before: unknown, after: unknown): { key: string; from: string; to: string }[] {
  const b = before && typeof before === "object" ? (before as Record<string, unknown>) : {};
  const a = after && typeof after === "object" ? (after as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const rows: { key: string; from: string; to: string }[] = [];
  for (const key of keys) {
    if (key === "createdAt" || key === "updatedAt" || key === "id") continue;
    const bv = b[key];
    const av = a[key];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    rows.push({ key, from: formatVal(bv), to: formatVal(av) });
  }
  return rows;
}

export function ChangesFeed({ changes, actors, entityTypes }: ChangesFeedProps) {
  const router = useRouter();
  const [actorFilter, setActorFilter] = React.useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = React.useState<"all" | EntityType>("all");
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () =>
      changes.filter((c) => {
        if (actorFilter !== "all" && c.actorId !== actorFilter) return false;
        if (entityTypeFilter !== "all" && c.entityType !== entityTypeFilter) return false;
        return true;
      }),
    [changes, actorFilter, entityTypeFilter],
  );

  async function handleRevert(entry: ChangeEntryDTO) {
    setError(null);
    setNotice(null);
    setPendingId(entry.id);
    const result = await revertChangeAction(entry.id);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Reverted "${describeAction(entry)}" on ${describeEntity(entry)}.`);
    router.refresh();
  }

  async function handleRevertGroup(entry: ChangeEntryDTO) {
    if (!entry.bulkGroup) return;
    setError(null);
    setNotice(null);
    setPendingId(entry.bulkGroup.pendingChangeId);
    const result = await revertBulkGroupAction(entry.bulkGroup.pendingChangeId);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Reverted the whole batch (${result.data.revertedCount} item(s)).`);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      {error && (
        <Card style={{ borderColor: "var(--accent-primary)" }}>
          <p style={{ color: "var(--accent-primary)", margin: 0, fontFamily: "var(--font-body)" }}>{error}</p>
        </Card>
      )}
      {notice && (
        <Card accent>
          <p style={{ margin: 0, fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>{notice}</p>
        </Card>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <label style={labelStyle}>User</label>
          <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} style={selectStyle}>
            <option value="all">All users</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <label style={labelStyle}>Entity</label>
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value as "all" | EntityType)}
            style={selectStyle}
          >
            <option value="all">All entities</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {friendly(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 && (
        <Card>
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", margin: 0 }}>
            No changes match this filter.
          </p>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {filtered.map((entry) => {
          const rows = summarizeChange(entry.before, entry.after);
          return (
            <Card key={entry.id} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--sp-3)" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-primary)" }}>
                    {describeAction(entry)} — {describeEntity(entry)}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                    {entry.actorName ?? (entry.actorType === "system" ? describeSurface(entry.surface) : entry.actorType === "display" ? "Display" : "Unknown user")}
                    {" · "}
                    {new Date(entry.createdAt).toLocaleString()}
                    {entry.bulkGroup && " · part of a bulk change"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--sp-2)", flexShrink: 0 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pendingId === entry.id}
                    onClick={() => handleRevert(entry)}
                  >
                    {pendingId === entry.id ? "Reverting…" : "Revert"}
                  </Button>
                  {entry.bulkGroup && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={pendingId === entry.bulkGroup.pendingChangeId}
                      onClick={() => handleRevertGroup(entry)}
                    >
                      {pendingId === entry.bulkGroup.pendingChangeId ? "Reverting…" : "Revert whole batch"}
                    </Button>
                  )}
                </div>
              </div>

              {rows.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                  {rows.map((r) => (
                    <div key={r.key} style={{ color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--text-faint)" }}>{r.key}:</span> {r.from} → {r.to}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
