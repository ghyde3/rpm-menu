"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ds";
import type { Tag as TagRow } from "@/db/schema";
import { createTagAction, updateTagAction, deleteTagAction } from "./actions";

export interface TagsManagerProps {
  initialTags: TagRow[];
  isOwner: boolean;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

export function TagsManager({ initialTags, isOwner }: TagsManagerProps) {
  const router = useRouter();
  const [tags, setTags] = React.useState(initialTags);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const [name, setName] = React.useState("");
  const [visibility, setVisibility] = React.useState<"public" | "private">("private");
  const [icon, setIcon] = React.useState("");
  const [color, setColor] = React.useState("");

  // Re-sync when the server passes fresh tags after a refresh — set during
  // render (not an effect) per react-hooks/set-state-in-effect.
  const [prevInitialTags, setPrevInitialTags] = React.useState(initialTags);
  if (initialTags !== prevInitialTags) {
    setPrevInitialTags(initialTags);
    setTags(initialTags);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const result = await createTagAction({
      name: name.trim(),
      visibility,
      icon: icon.trim() || null,
      color: color.trim() || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setIcon("");
    setColor("");
    router.refresh();
  }

  async function handleToggleVisibility(tag: TagRow) {
    setError(null);
    const next = tag.visibility === "public" ? "private" : "public";
    setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, visibility: next } : t)));
    const result = await updateTagAction(tag.id, { visibility: next });
    if (!result.ok) {
      setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, visibility: tag.visibility } : t)));
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(tag: TagRow) {
    if (!window.confirm(`Delete tag "${tag.name}"? Items keep no record of it once removed.`)) return;
    setError(null);
    const result = await deleteTagAction(tag.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTags((prev) => prev.filter((t) => t.id !== tag.id));
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {error && (
        <Card style={{ borderColor: "var(--accent-primary)" }}>
          <p style={{ color: "var(--accent-primary)", margin: 0, fontFamily: "var(--font-body)" }}>{error}</p>
        </Card>
      )}

      {isOwner && (
        <Card accent>
          <form
            onSubmit={handleCreate}
            style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "flex-end" }}
          >
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. spicy"
              style={{ minWidth: 160 }}
              required
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <label style={labelStyle}>Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "public" | "private")}
                style={{
                  height: 44,
                  background: "var(--surface-inset)",
                  border: "var(--bw) solid var(--border-strong)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-body)",
                  padding: "0 var(--sp-3)",
                }}
              >
                <option value="private">Private (internal only)</option>
                <option value="public">Public (shows as a badge)</option>
              </select>
            </div>
            <Input
              label="Icon"
              hint="optional, e.g. 🌶️ or GF"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              style={{ minWidth: 120 }}
            />
            <Input
              label="Color"
              hint="optional hex"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#e0463c"
              style={{ minWidth: 120 }}
            />
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Adding…" : "Add Tag"}
            </Button>
          </form>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {tags.length === 0 && (
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)" }}>No tags yet.</p>
        )}
        {tags.map((tag) => (
          <Card key={tag.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
              <span
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "var(--radius-sm)",
                  background: tag.color || "var(--border-strong)",
                  border: "1px solid var(--border-hairline)",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", fontWeight: 600 }}>
                  {tag.icon ? `${tag.icon} ` : ""}
                  {tag.name}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                  {tag.visibility === "public" ? "Public — renders as a badge" : "Private — internal only"}
                </div>
              </div>
            </div>
            {isOwner && (
              <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                <Button variant="secondary" size="sm" onClick={() => handleToggleVisibility(tag)}>
                  Make {tag.visibility === "public" ? "private" : "public"}
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(tag)}>
                  Delete
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {!isOwner && (
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
          Tag definitions are owner-managed — ask an owner to add, edit, or remove a tag. You can still attach
          existing tags to items from the item editor.
        </p>
      )}
    </div>
  );
}
