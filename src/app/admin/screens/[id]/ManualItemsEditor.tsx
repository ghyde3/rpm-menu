"use client";

// Manual-mode explicit ordered item list (§3.2 "for curated screens").
// Simple add/remove/reorder (up/down) rather than drag-and-drop — §3.2 is
// explicit that Phase 1 ships "no drag-and-drop layout editor ... templates
// with knobs, period."
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ds";
import type { Item } from "@/db/schema";
import { setScreenItemsAction } from "../actions";

export interface ManualItemsEditorProps {
  screenId: string;
  allItems: Item[];
  initialItemIds: string[];
}

export function ManualItemsEditor({ screenId, allItems, initialItemIds }: ManualItemsEditorProps) {
  const router = useRouter();
  const itemsById = React.useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const [orderedIds, setOrderedIds] = React.useState<string[]>(initialItemIds.filter((id) => itemsById.has(id)));
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const selectedSet = React.useMemo(() => new Set(orderedIds), [orderedIds]);
  const candidates = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems
      .filter((i) => !selectedSet.has(i.id))
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems, selectedSet, search]);

  function add(id: string) {
    setSaved(false);
    setOrderedIds((prev) => [...prev, id]);
  }
  function remove(id: string) {
    setSaved(false);
    setOrderedIds((prev) => prev.filter((x) => x !== id));
  }
  function move(index: number, dir: -1 | 1) {
    setSaved(false);
    setOrderedIds((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await setScreenItemsAction(screenId, orderedIds);
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
      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "0.875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "var(--ls-caps)",
          color: "var(--text-muted)",
          marginBottom: "var(--sp-3)",
        }}
      >
        Curated item list
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {orderedIds.length === 0 && (
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
            No items added yet — pick some below.
          </p>
        )}
        {orderedIds.map((id, index) => {
          const item = itemsById.get(id);
          if (!item) return null;
          return (
            <div
              key={id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-3)",
                padding: "var(--sp-2) var(--sp-3)",
                background: "var(--surface-inset)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span style={{ fontFamily: "var(--font-body)", color: "var(--text-faint)", fontSize: "0.8125rem", width: 24 }}>
                {index + 1}
              </span>
              <span style={{ flex: 1, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
                {item.name}
              </span>
              <Button variant="ghost" size="sm" type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === orderedIds.length - 1}
              >
                ↓
              </Button>
              <Button variant="danger" size="sm" type="button" onClick={() => remove(id)}>
                Remove
              </Button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "var(--sp-4)" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items to add…"
          style={{
            width: "100%",
            height: 44,
            background: "var(--surface-inset)",
            border: "var(--bw) solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            padding: "0 var(--sp-3)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-1)",
            marginTop: "var(--sp-2)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {candidates.slice(0, 25).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => add(item.id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                textAlign: "left",
                padding: "var(--sp-2) var(--sp-3)",
                background: "transparent",
                border: "var(--bw) solid var(--border-strong)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              <span>{item.name}</span>
              <span style={{ color: "var(--text-faint)" }}>+ Add</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginTop: "var(--sp-4)" }}>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Item List"}
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
    </Card>
  );
}
