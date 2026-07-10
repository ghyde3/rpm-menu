"use client";

// Query-mode `source_config` editor (§3.2: "all items with tag `draft`,
// ordered by sort_order — auto-updates as items change"). A screen matches
// items whose category is in `categoryIds` OR whose tags intersect
// `tagIds` (union, mirroring bumpAffectedScreens's own tag/category-hit
// logic in src/lib/service/base/bump-affected-screens.ts).
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ds";
import type { Category, Tag as TagRow } from "@/db/schema";
import type { Screen } from "@/lib/service/screens";
import { updateScreenAction } from "../actions";

export interface SourceConfigEditorProps {
  screen: Screen;
  categories: Category[];
  tags: TagRow[];
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

const chipStyle = (active: boolean): React.CSSProperties => ({
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
});

export function SourceConfigEditor({ screen, categories, tags }: SourceConfigEditorProps) {
  const router = useRouter();
  const cfg = screen.sourceConfig ?? {};
  const [categoryIds, setCategoryIds] = React.useState<Set<string>>(new Set(cfg.categoryIds ?? []));
  const [tagIds, setTagIds] = React.useState<Set<string>>(new Set(cfg.tagIds ?? []));
  const [orderBy, setOrderBy] = React.useState<"sort_order" | "name" | "price">(
    (cfg.orderBy as "sort_order" | "name" | "price" | undefined) ?? "sort_order",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    setSaved(false);
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateScreenAction(screen.id, {
      sourceConfig: {
        categoryIds: Array.from(categoryIds),
        tagIds: Array.from(tagIds),
        orderBy,
      },
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <h2 style={{ ...labelStyle, fontSize: "0.875rem", marginBottom: "var(--sp-2)" }}>Query source</h2>
      <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: 0 }}>
        Matches items in any selected category OR carrying any selected tag. Auto-updates as items change.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <div>
          <label style={labelStyle}>Categories</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)", marginTop: "var(--sp-2)" }}>
            {categories.length === 0 && (
              <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                No categories yet.
              </span>
            )}
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(categoryIds, setCategoryIds, c.id)}
                style={chipStyle(categoryIds.has(c.id))}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)", marginTop: "var(--sp-2)" }}>
            {tags.length === 0 && (
              <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                No tags yet.
              </span>
            )}
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(tagIds, setTagIds, t.id)}
                style={chipStyle(tagIds.has(t.id))}
              >
                {t.icon ? `${t.icon} ` : ""}
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", maxWidth: 220 }}>
          <label style={labelStyle}>Order by</label>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as "sort_order" | "name" | "price")}
            style={{
              height: "var(--tap-target)",
              background: "var(--surface-inset)",
              border: "var(--bw) solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              padding: "0 var(--sp-3)",
            }}
          >
            <option value="sort_order">Sort order</option>
            <option value="name">Name</option>
            <option value="price">Price</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Source"}
          </Button>
          {saved && (
            <span style={{ color: "var(--accent-new)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
              Saved
            </span>
          )}
          {error && (
            <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
              {error}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
