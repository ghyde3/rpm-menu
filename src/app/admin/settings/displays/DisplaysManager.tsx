"use client";

// Settings > Displays (§3.8) + the weekly schedule editor (§3.2a). One
// client component driving: pair-new-display, per-display reassign/revoke/
// delete/re-pair, and an inline schedule-rules editor per display.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ds";
import type { DisplayWithStatus, HeartbeatStatus } from "@/lib/service/displays";
import type { DisplaySchedule } from "@/lib/service/schedules";
import {
  claimPairingCodeAction,
  updateDisplayAction,
  revokeDisplayAction,
  deleteDisplayAction,
  createScheduleAction,
  updateScheduleAction,
  deleteScheduleAction,
} from "./actions";

export interface ScreenOption {
  id: string;
  name: string;
}

export interface DisplaysManagerProps {
  initialDisplays: DisplayWithStatus[];
  screens: ScreenOption[];
  initialSchedulesByDisplay: Record<string, DisplaySchedule[]>;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HEARTBEAT_COLOR: Record<HeartbeatStatus, string> = {
  online: "var(--accent-new, #3ba55d)",
  warning: "#e8b93a",
  offline: "var(--text-faint)",
};

const HEARTBEAT_LABEL: Record<HeartbeatStatus, string> = {
  online: "Online",
  warning: "Slow to check in",
  offline: "Offline",
};

function formatRelativeTime(value: Date | string | null): string {
  if (!value) return "Never";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  fontSize: "0.9375rem",
  color: "var(--text-primary)",
  margin: "0 0 var(--sp-4) 0",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

function selectStyle(): React.CSSProperties {
  return {
    background: "var(--surface-inset)",
    border: "var(--bw) solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--fs-body-sm)",
    height: 44,
    padding: "0 var(--sp-3)",
  };
}

function ScreenSelect({
  value,
  onChange,
  screens,
  allowNone = true,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  screens: ScreenOption[];
  allowNone?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      style={selectStyle()}
    >
      {allowNone && <option value="">— No screen assigned —</option>}
      {screens.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function PairNewDisplayCard({ screens, onPaired }: { screens: ScreenOption[]; onPaired: () => void }) {
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [screenId, setScreenId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (code.trim().length !== 6) {
      setMessage({ kind: "error", text: "Enter the 6-character code shown on the TV." });
      return;
    }
    setSubmitting(true);
    const result = await claimPairingCodeAction({
      code: code.trim().toUpperCase(),
      name: name.trim() || undefined,
      screenId,
    });
    setSubmitting(false);
    if (result.ok) {
      setMessage({ kind: "success", text: `Paired "${result.data.name}". It will start rendering shortly.` });
      setCode("");
      setName("");
      setScreenId(null);
      onPaired();
    } else {
      setMessage({ kind: "error", text: result.error });
    }
  }

  return (
    <Card>
      <h2 style={sectionTitleStyle}>Pair New Display</h2>
      <p style={{ ...labelStyle, textTransform: "none", letterSpacing: "normal", marginBottom: "var(--sp-4)" }}>
        Load <code>/display</code> on the TV, then enter the 6-character code it shows.
      </p>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "flex-end" }}
      >
        <Input
          label="Pairing Code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          style={{ width: 160 }}
        />
        <Input
          label="Display Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bar TV"
          style={{ width: 220 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <span style={labelStyle}>Default Screen</span>
          <ScreenSelect value={screenId} onChange={setScreenId} screens={screens} />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Pairing…" : "Pair Display"}
        </Button>
      </form>
      {message && (
        <p
          style={{
            marginTop: "var(--sp-3)",
            color: message.kind === "success" ? "var(--accent-new)" : "var(--accent-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
          }}
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}

function RepairInline({ displayId, onDone }: { displayId: string; onDone: () => void }) {
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length !== 6) {
      setError("Enter the 6-character code shown on the TV.");
      return;
    }
    setSubmitting(true);
    const result = await claimPairingCodeAction({ code: code.trim().toUpperCase(), existingDisplayId: displayId });
    setSubmitting(false);
    if (result.ok) {
      setCode("");
      onDone();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="New code"
        maxLength={6}
        style={{ ...selectStyle(), width: 110, height: 34 }}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={submitting}>
        {submitting ? "Re-pairing…" : "Re-pair"}
      </Button>
      {error && <span style={{ color: "var(--accent-primary)", fontSize: "0.8125rem" }}>{error}</span>}
    </form>
  );
}

function ScheduleEditor({
  displayId,
  screens,
  schedules,
  onChanged,
}: {
  displayId: string;
  screens: ScreenOption[];
  schedules: DisplaySchedule[];
  onChanged: () => void;
}) {
  const screenName = (id: string) => screens.find((s) => s.id === id)?.name ?? "Unknown screen";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      {schedules.length === 0 ? (
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
          No rules yet — this display always shows its default screen.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {schedules.map((rule) => (
            <ScheduleRuleRow
              key={rule.id}
              rule={rule}
              screens={screens}
              screenName={screenName(rule.screenId)}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
      <NewScheduleRuleForm displayId={displayId} screens={screens} onCreated={onChanged} />
    </div>
  );
}

function DayToggles({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {DAY_LABELS.map((label, i) => {
        const active = value.includes(i);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(active ? value.filter((d) => d !== i) : [...value, i])}
            style={{
              width: 34,
              height: 34,
              borderRadius: "var(--radius-sm)",
              border: active ? "var(--bw) solid var(--accent-primary)" : "var(--bw) solid var(--border-hairline)",
              background: active ? "var(--surface-hover)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-faint)",
              fontFamily: "var(--font-heading)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {label[0]}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleRuleRow({
  rule,
  screens,
  screenName,
  onChanged,
}: {
  rule: DisplaySchedule;
  screens: ScreenOption[];
  screenName: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [days, setDays] = React.useState(rule.days);
  const [startTime, setStartTime] = React.useState(rule.startTime.slice(0, 5));
  const [endTime, setEndTime] = React.useState(rule.endTime.slice(0, 5));
  const [screenId, setScreenId] = React.useState(rule.screenId);
  const [priority, setPriority] = React.useState(rule.priority);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const result = await updateScheduleAction(rule.id, { days, startTime, endTime, screenId, priority });
    setBusy(false);
    if (result.ok) {
      setEditing(false);
      onChanged();
    } else {
      setError(result.error);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this schedule rule?")) return;
    setBusy(true);
    const result = await deleteScheduleAction(rule.id);
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.error);
  }

  if (!editing) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--sp-3)",
          padding: "var(--sp-3)",
          border: "var(--bw) solid var(--border-hairline)",
          borderRadius: "var(--radius-sm)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--text-primary)" }}>
            {rule.days
              .slice()
              .sort((a, b) => a - b)
              .map((d) => DAY_LABELS[d])
              .join(", ")}{" "}
            · {rule.startTime.slice(0, 5)}–{rule.endTime.slice(0, 5)} → <strong>{screenName}</strong>
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>Priority {rule.priority}</span>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={handleDelete} disabled={busy}>
            Delete
          </Button>
        </div>
        {error && <span style={{ color: "var(--accent-primary)", fontSize: "0.8125rem" }}>{error}</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)",
        padding: "var(--sp-3)",
        border: "var(--bw) solid var(--accent-primary)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <DayToggles value={days} onChange={setDays} />
      <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Start</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={selectStyle()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>End</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={selectStyle()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Screen</span>
          <ScreenSelect value={screenId} onChange={(id) => id && setScreenId(id)} screens={screens} allowNone={false} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Priority</span>
          <input
            type="number"
            value={priority}
            min={0}
            max={1000}
            onChange={(e) => setPriority(Number(e.target.value))}
            style={{ ...selectStyle(), width: 80 }}
          />
        </label>
        <Button size="sm" onClick={handleSave} disabled={busy}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error && <span style={{ color: "var(--accent-primary)", fontSize: "0.8125rem" }}>{error}</span>}
    </div>
  );
}

function NewScheduleRuleForm({
  displayId,
  screens,
  onCreated,
}: {
  displayId: string;
  screens: ScreenOption[];
  onCreated: () => void;
}) {
  const [days, setDays] = React.useState<number[]>([]);
  const [startTime, setStartTime] = React.useState("16:00");
  const [endTime, setEndTime] = React.useState("19:00");
  const [screenId, setScreenId] = React.useState<string | null>(screens[0]?.id ?? null);
  const [priority, setPriority] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (days.length === 0) {
      setError("Select at least one day.");
      return;
    }
    if (!screenId) {
      setError("Choose a screen for this rule.");
      return;
    }
    setBusy(true);
    const result = await createScheduleAction({ displayId, days, startTime, endTime, screenId, priority });
    setBusy(false);
    if (result.ok) {
      setDays([]);
      setPriority(0);
      onCreated();
    } else {
      setError(result.error);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)",
        padding: "var(--sp-3)",
        border: "var(--bw) dashed var(--border-strong)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <span style={labelStyle}>Add Rule</span>
      <DayToggles value={days} onChange={setDays} />
      <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Start</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={selectStyle()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>End</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={selectStyle()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Screen</span>
          <ScreenSelect value={screenId} onChange={setScreenId} screens={screens} allowNone={false} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Priority</span>
          <input
            type="number"
            value={priority}
            min={0}
            max={1000}
            onChange={(e) => setPriority(Number(e.target.value))}
            style={{ ...selectStyle(), width: 80 }}
          />
        </label>
        <Button size="sm" onClick={handleAdd} disabled={busy}>
          {busy ? "Adding…" : "Add Rule"}
        </Button>
      </div>
      {error && <span style={{ color: "var(--accent-primary)", fontSize: "0.8125rem" }}>{error}</span>}
    </div>
  );
}

function DisplayRow({
  display,
  screens,
  schedules,
  onChanged,
}: {
  display: DisplayWithStatus;
  screens: ScreenOption[];
  schedules: DisplaySchedule[];
  onChanged: () => void;
}) {
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleReassign(screenId: string | null) {
    setBusy(true);
    setError(null);
    const result = await updateDisplayAction(display.id, { screenId });
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.error);
  }

  async function handleRevoke() {
    if (!window.confirm(`Revoke "${display.name}"? It will blank to a re-pair screen on its next poll.`)) return;
    setBusy(true);
    setError(null);
    const result = await revokeDisplayAction(display.id);
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.error);
  }

  async function handleDelete() {
    if (!window.confirm(`Permanently delete "${display.name}" and its schedule?`)) return;
    setBusy(true);
    setError(null);
    const result = await deleteDisplayAction(display.id);
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.error);
  }

  const revoked = !!display.revokedAt;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--sp-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", minWidth: 200 }}>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.0625rem",
              color: "var(--text-primary)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
            }}
          >
            {display.name}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: revoked ? "var(--text-faint)" : HEARTBEAT_COLOR[display.heartbeat],
              }}
            />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>
              {revoked ? "Revoked" : HEARTBEAT_LABEL[display.heartbeat]} · last seen{" "}
              {formatRelativeTime(display.lastSeenAt)}
            </span>
          </div>
          {revoked && <RepairInline displayId={display.id} onDone={onChanged} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Default Screen</span>
          <ScreenSelect value={display.screenId} onChange={handleReassign} screens={screens} />
        </div>

        <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-start" }}>
          <Button size="sm" variant="secondary" onClick={() => setScheduleOpen((v) => !v)}>
            {scheduleOpen ? "Hide Schedule" : `Schedule (${schedules.length})`}
          </Button>
          {!revoked && (
            <Button size="sm" variant="danger" onClick={handleRevoke} disabled={busy}>
              Revoke
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>

      {error && (
        <p style={{ color: "var(--accent-primary)", fontSize: "0.8125rem", marginTop: "var(--sp-2)" }}>{error}</p>
      )}

      {scheduleOpen && (
        <div style={{ marginTop: "var(--sp-4)", paddingTop: "var(--sp-4)", borderTop: "var(--bw) solid var(--border-hairline)" }}>
          <ScheduleEditor displayId={display.id} screens={screens} schedules={schedules} onChanged={onChanged} />
        </div>
      )}
    </Card>
  );
}

export function DisplaysManager({ initialDisplays, screens, initialSchedulesByDisplay }: DisplaysManagerProps) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <PairNewDisplayCard screens={screens} onPaired={refresh} />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {initialDisplays.length === 0 ? (
          <Card>
            <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", margin: 0 }}>
              No displays paired yet — load <code>/display</code> on a TV to get started.
            </p>
          </Card>
        ) : (
          initialDisplays.map((display) => (
            <DisplayRow
              key={display.id}
              display={display}
              screens={screens}
              schedules={initialSchedulesByDisplay[display.id] ?? []}
              onChanged={refresh}
            />
          ))
        )}
      </div>
    </div>
  );
}
