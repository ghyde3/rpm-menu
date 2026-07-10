"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ds";
import type { Category } from "@/db/schema";
import { ATTRIBUTE_KEYS, type AttributeKey } from "@/lib/menu/display-line";
import { updateCategoryAction, deleteCategoryAction } from "../actions";

export interface CategoryEditorProps {
  category: Category;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

const ATTRIBUTE_DISPLAY_NAMES: Record<AttributeKey, string> = {
  abv: "ABV",
  ibu: "IBU",
  flavor_profile: "Flavor profile",
  origin: "Origin",
  calories: "Calories",
  style: "Style",
};

export function CategoryEditor({ category }: CategoryEditorProps) {
  const router = useRouter();
  const [name, setName] = React.useState(category.name);
  const [type, setType] = React.useState(category.type);
  const [tagline, setTagline] = React.useState(category.tagline ?? "");
  const [sortOrder, setSortOrder] = React.useState(category.sortOrder);
  const [attributeOrder, setAttributeOrder] = React.useState<AttributeKey[]>(
    category.displayConfig.attributeOrder ?? [],
  );
  const [showDescriptionWeb, setShowDescriptionWeb] = React.useState(
    category.displayConfig.showDescription?.web ?? true,
  );
  const [showDescriptionDisplay, setShowDescriptionDisplay] = React.useState(
    category.displayConfig.showDescription?.display ?? (category.type === "food"),
  );
  const [showBadges, setShowBadges] = React.useState(category.displayConfig.showBadges ?? true);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function toggleAttribute(key: AttributeKey) {
    setSaved(false);
    setAttributeOrder((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function moveAttribute(key: AttributeKey, direction: -1 | 1) {
    setSaved(false);
    setAttributeOrder((prev) => {
      const index = prev.indexOf(key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await updateCategoryAction(category.id, {
      name: name.trim(),
      type,
      tagline: tagline.trim() || null,
      sortOrder,
      displayConfig: {
        attributeOrder,
        showDescription: { web: showDescriptionWeb, display: showDescriptionDisplay },
        showBadges,
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

  async function handleDelete() {
    if (!window.confirm(`Delete category "${category.name}"? It must have no items first.`)) return;
    setError(null);
    const result = await deleteCategoryAction(category.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/categories");
  }

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {error && (
        <Card style={{ borderColor: "var(--accent-primary)" }}>
          <p style={{ color: "var(--accent-primary)", margin: 0, fontFamily: "var(--font-body)" }}>{error}</p>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 220 }} required />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            <label style={labelStyle}>Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "food" | "drink")}
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
              <option value="food">Food</option>
              <option value="drink">Drink</option>
            </select>
          </div>
          <Input
            label="Tagline"
            hint="e.g. ★ Made to Share!"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <Input
            label="Sort order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </div>
      </Card>

      <Card>
        <h2 style={{ ...labelStyle, fontSize: "0.875rem", marginBottom: "var(--sp-3)" }}>
          Item display line (§3.1)
        </h2>
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: 0 }}>
          Choose which typed attributes render for items in this category, and in what order — e.g. Draft
          Beer might show ABV then IBU; Cocktails might show just flavor profile.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", marginTop: "var(--sp-3)" }}>
          {ATTRIBUTE_KEYS.map((key) => {
            const index = attributeOrder.indexOf(key);
            const active = index !== -1;
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--sp-3)",
                  padding: "var(--sp-2) var(--sp-3)",
                  background: active ? "var(--surface-inset)" : "transparent",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: 1, cursor: "pointer" }}>
                  <input type="checkbox" checked={active} onChange={() => toggleAttribute(key)} />
                  <span style={{ fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>
                    {ATTRIBUTE_DISPLAY_NAMES[key]}
                  </span>
                </label>
                {active && (
                  <>
                    <span style={{ color: "var(--text-faint)", fontSize: "0.75rem", fontFamily: "var(--font-body)" }}>
                      #{index + 1}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveAttribute(key, -1)} disabled={index === 0}>
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveAttribute(key, 1)}
                      disabled={index === attributeOrder.length - 1}
                    >
                      ↓
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-5)", marginTop: "var(--sp-5)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={showDescriptionWeb} onChange={(e) => setShowDescriptionWeb(e.target.checked)} />
            <span style={{ fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>Show description on web</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showDescriptionDisplay}
              onChange={(e) => setShowDescriptionDisplay(e.target.checked)}
            />
            <span style={{ fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>Show description on TV</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={showBadges} onChange={(e) => setShowBadges(e.target.checked)} />
            <span style={{ fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>Show tag badges</span>
          </label>
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="danger" type="button" onClick={handleDelete}>
          Delete Category
        </Button>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          {saved && (
            <span style={{ color: "var(--accent-new)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
              Saved
            </span>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
