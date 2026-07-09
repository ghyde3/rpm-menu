"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Switch } from "@/components/ds";
import type { ModifierSelectionType } from "@/db/schema";
import { createModifierGroupAction } from "../actions";

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

export function NewGroupForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [selectionType, setSelectionType] = React.useState<ModifierSelectionType>("single");
  const [minSelect, setMinSelect] = React.useState("0");
  const [maxSelect, setMaxSelect] = React.useState("");
  const [isRequired, setIsRequired] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const result = await createModifierGroupAction({
      name: name.trim(),
      selectionType,
      minSelect: Number(minSelect) || 0,
      maxSelect: maxSelect.trim() ? Number(maxSelect) : null,
      isRequired,
      sortOrder: 0,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/admin/modifiers/${result.data.id}`);
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <Input
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wing Sauce Choice"
        />

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

        <div>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Creating…" : "Create Group"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
