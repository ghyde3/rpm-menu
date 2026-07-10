"use client";

// Attaching existing tags to an item is a routine, staff-doable action
// (§2) — tag *definitions* (create/edit/delete/visibility) are owner-only
// and live on /admin/items/tags.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import type { Tag as TagRow } from "@/db/schema";
import { setItemTagsAction } from "../actions";

export interface TagAssignmentProps {
  itemId: string;
  allTags: TagRow[];
  initialTagIds: string[];
}

export function TagAssignment({ itemId, allTags, initialTagIds }: TagAssignmentProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set(initialTagIds));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function toggle(tagId: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await setItemTagsAction(itemId, Array.from(selected));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  if (allTags.length === 0) {
    return (
      <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
        No tags exist yet — an owner can add some on the Tags page.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
        {allTags.map((tag) => {
          const active = selected.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                padding: "var(--sp-1) var(--sp-3)",
                borderRadius: "var(--radius-pill)",
                border: "var(--bw) solid " + (active ? "var(--accent-primary)" : "var(--border-strong)"),
                background: active ? "var(--accent-primary)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                fontFamily: "var(--font-heading)",
                fontSize: "0.8125rem",
                textTransform: "uppercase",
                letterSpacing: "var(--ls-caps)",
                cursor: "pointer",
              }}
            >
              {tag.icon ? `${tag.icon} ` : ""}
              {tag.name}
              {tag.visibility === "private" && (
                <span style={{ opacity: 0.7, fontSize: "0.6875rem" }}>(private)</span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Tags"}
        </Button>
        {saved && (
          <span style={{ color: "var(--accent-new)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>Saved</span>
        )}
        {error && (
          <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
