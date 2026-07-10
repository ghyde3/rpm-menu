"use client";

// Core item fields — name/description/price/category/availability/sort
// order/aliases/typed attributes (§3.1). Shared by the create page and the
// edit page; price fields are read-only for staff (service layer enforces
// this too — §2 "staff... cannot change prices" — this is the UX mirror of
// that, not the enforcement).
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Switch, Textarea } from "@/components/ds";
import type { Category, Item } from "@/db/schema";
import { createItemAction, updateItemAction } from "./actions";

export interface ItemFormProps {
  categories: Category[];
  isOwner: boolean;
  item?: Item;
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

function centsToDollarsString(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2);
}

function dollarsStringToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dollars = Number(trimmed);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

export function ItemForm({ categories, isOwner, item }: ItemFormProps) {
  const router = useRouter();
  const isEdit = Boolean(item);

  const [name, setName] = React.useState(item?.name ?? "");
  const [categoryId, setCategoryId] = React.useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [description, setDescription] = React.useState(item?.description ?? "");
  const [priceInput, setPriceInput] = React.useState(centsToDollarsString(item?.priceCents ?? null));
  const [pricingType, setPricingType] = React.useState(item?.pricingType ?? "fixed");
  const [isAvailable, setIsAvailable] = React.useState(item?.isAvailable ?? true);
  const [sortOrder, setSortOrder] = React.useState(item?.sortOrder ?? 0);
  const [aliasesInput, setAliasesInput] = React.useState((item?.aliases ?? []).join(", "));

  const [abv, setAbv] = React.useState(item?.attributes.abv?.toString() ?? "");
  const [ibu, setIbu] = React.useState(item?.attributes.ibu?.toString() ?? "");
  const [flavorProfile, setFlavorProfile] = React.useState(item?.attributes.flavor_profile ?? "");
  const [origin, setOrigin] = React.useState(item?.attributes.origin ?? "");
  const [calories, setCalories] = React.useState(item?.attributes.calories?.toString() ?? "");
  const [style, setStyle] = React.useState(item?.attributes.style ?? "");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function buildAttributes() {
    const attributes: Record<string, number | string> = {};
    if (abv.trim()) attributes.abv = Number(abv);
    if (ibu.trim()) attributes.ibu = Number(ibu);
    if (flavorProfile.trim()) attributes.flavor_profile = flavorProfile.trim();
    if (origin.trim()) attributes.origin = origin.trim();
    if (calories.trim()) attributes.calories = Number(calories);
    if (style.trim()) attributes.style = style.trim();
    return attributes;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const base = {
      name: name.trim(),
      categoryId,
      description: description.trim() || null,
      isAvailable,
      sortOrder,
      aliases: aliasesInput
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      attributes: buildAttributes(),
    };

    // Only owners may set price fields — omit them entirely for a staff
    // caller so a routine description/availability edit never trips the
    // service layer's owner-only price check (§2).
    const priceFields = isOwner ? { priceCents: dollarsStringToCents(priceInput), pricingType } : {};

    if (isEdit && item) {
      const result = await updateItemAction(item.id, { ...base, ...priceFields });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } else {
      const result = await createItemAction({ ...base, ...priceFields });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/items/${result.data.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {error && (
        <Card style={{ borderColor: "var(--accent-primary)" }}>
          <p style={{ color: "var(--accent-primary)", margin: 0, fontFamily: "var(--font-body)" }}>{error}</p>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 240, flex: 1 }} required />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <label style={labelStyle}>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...selectStyle, minWidth: 200 }} required>
                {categories.length === 0 && <option value="">No categories yet</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "flex-end" }}>
            <Input
              label="Price"
              prefix="$"
              type="number"
              step="0.01"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              disabled={!isOwner}
              hint={!isOwner ? "Owner only" : "Leave blank for ask-server / TBD items"}
              style={{ width: 160 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <label style={labelStyle}>Pricing type</label>
              <select
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value as typeof pricingType)}
                disabled={!isOwner}
                style={selectStyle}
              >
                <option value="fixed">Fixed</option>
                <option value="ask_server">Ask your server</option>
                <option value="tbd">TBD (not entered yet)</option>
              </select>
            </div>
            <Input
              label="Sort order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <Switch checked={isAvailable} onChange={setIsAvailable} label={isAvailable ? "Available" : "86'd"} />
          </div>

          <Input
            label="Aliases"
            hint="Comma-separated alternate names staff use, e.g. chicken fingers, tenders"
            value={aliasesInput}
            onChange={(e) => setAliasesInput(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h2 style={{ ...labelStyle, fontSize: "0.875rem", marginBottom: "var(--sp-3)" }}>Typed attributes</h2>
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: 0 }}>
          Which of these render — and in what order — is controlled by the item&apos;s category display settings.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
          <Input label="ABV %" type="number" step="0.1" value={abv} onChange={(e) => setAbv(e.target.value)} style={{ width: 120 }} />
          <Input label="IBU" type="number" value={ibu} onChange={(e) => setIbu(e.target.value)} style={{ width: 120 }} />
          <Input label="Style" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Hefeweizen" style={{ width: 160 }} />
          <Input
            label="Flavor profile"
            value={flavorProfile}
            onChange={(e) => setFlavorProfile(e.target.value)}
            placeholder="smoky · citrus · bitter"
            style={{ minWidth: 200 }}
          />
          <Input label="Origin" value={origin} onChange={(e) => setOrigin(e.target.value)} style={{ width: 160 }} />
          <Input label="Calories" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} style={{ width: 120 }} />
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--sp-3)" }}>
        {saved && (
          <span style={{ color: "var(--accent-new)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>Saved</span>
        )}
        <Button type="submit" disabled={saving || !name.trim() || !categoryId}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Item"}
        </Button>
      </div>
    </form>
  );
}
