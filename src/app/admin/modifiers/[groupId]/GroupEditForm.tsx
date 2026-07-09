"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Switch } from "@/components/ds";
import type { ModifierGroup, ModifierSelectionType } from "@/db/schema";
import { updateModifierGroupAction, deleteModifierGroupAction } from "../actions";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

const selectStyle: React.CSSProperties = {
  height: 44,
  background: "var(--surface-inset)",
  border: "var(--bw) solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-body)",
  padding: "0 var(--sp-3)",
};

export interface GroupEditFormProps {
  group: ModifierGroup;
}

export function GroupEditForm({ group }: GroupEditFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(group.name);
  const [selectionType, setSelectionType] = React.useState<ModifierSelectionType>(group.selectionType);
  const [minSelect, setMinSelect] = React.useState(String(group.minSelect));
  const [maxSelect, setMaxSelect] = React.useState(group.maxSelect != null ? String(group.maxSelect) : "");
  const [isRequired, setIsRequired] = React.useState(group.isRequired);
  const [pending, setPending] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await updateModifierGroupAction(group.id, {
      name: name.trim(),
      selectionType,
      minSelect: Number(minSelect) || 0,
      maxSelect: maxSelect.trim() ? Number(maxSelect) : null,
      isRequired,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${group.name}"? This removes all its options and attachments.`)) return;
    setDeleting(true);
    setError(null);
    const result = await deleteModifierGroupAction(group.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/modifiers");
  }

  return (
    <Card>
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <label style={labelStyle}>Selection type</label>
          <select
            value={selectionType}
            onChange={(e) => setSelectionType(e.target.value as ModifierSelectionType)}
            style={selectStyle}
          >
            <option value="single">Single choice (radio)</option>
            <option value="multiple">Multiple choice (checkboxes)</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Input
            label="Min select"
            type="number"
            min={0}
            value={minSelect}
            onChange={(e) => setMinSelect(e.target.value)}
            style={{ width: 140 }}
          />
          <Input
            label="Max select"
            type="number"
            min={1}
            value={maxSelect}
            onChange={(e) => setMaxSelect(e.target.value)}
            placeholder="Unlimited"
            style={{ width: 140 }}
          />
        </div>

        <Switch checked={isRequired} onChange={setIsRequired} label="Required" />

        {error && (
          <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", margin: 0 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {saved && <span style={{ color: "var(--accent-new)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>Saved</span>}
          <div style={{ flex: 1 }} />
          <Button type="button" variant="danger" size="sm" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete Group"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
