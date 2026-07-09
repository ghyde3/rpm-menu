"use client";

// Price variant CRUD — addendum §2: `item_price_variants.kind` is either
// `size` (multiple allowed, shown on the base menu) or `happy_hour` (at
// most one per item in this editor, surfaced by the M2 screens unit's
// happy-hour screen via `display_options.price_mode = 'happy_hour'` —
// see src/lib/screens/resolve.ts's `buildPriceInfo`, which looks up the
// item's single happy_hour variant). Owner-only (§2: staff cannot change
// prices).
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ds";
import { formatPrice } from "@/lib/pricing";
import type { ItemPriceVariant } from "@/db/schema";
import { createItemPriceVariantAction, deleteItemPriceVariantAction } from "../actions";

export interface PriceVariantsEditorProps {
  itemId: string;
  initialVariants: ItemPriceVariant[];
  isOwner: boolean;
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

export function PriceVariantsEditor({ itemId, initialVariants, isOwner }: PriceVariantsEditorProps) {
  const router = useRouter();
  const [variants, setVariants] = React.useState(initialVariants);
  const [label, setLabel] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [happyHourPrice, setHappyHourPrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [happyHourPending, setHappyHourPending] = React.useState(false);

  // Re-sync when the server passes fresh variants after a refresh — set
  // during render (not an effect) per react-hooks/set-state-in-effect.
  const [prevInitialVariants, setPrevInitialVariants] = React.useState(initialVariants);
  if (initialVariants !== prevInitialVariants) {
    setPrevInitialVariants(initialVariants);
    setVariants(initialVariants);
  }

  const sizeVariants = variants.filter((v) => v.kind === "size");
  const happyHourVariant = variants.find((v) => v.kind === "happy_hour") ?? null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(price) * 100);
    if (!label.trim() || !Number.isFinite(priceCents)) return;
    setPending(true);
    setError(null);
    const result = await createItemPriceVariantAction({
      itemId,
      label: label.trim(),
      priceCents,
      sortOrder: sizeVariants.length,
      kind: "size",
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLabel("");
    setPrice("");
    router.refresh();
  }

  async function handleSetHappyHourPrice(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(happyHourPrice) * 100);
    if (!Number.isFinite(priceCents)) return;
    setHappyHourPending(true);
    setError(null);
    const result = await createItemPriceVariantAction({
      itemId,
      label: "Happy Hour",
      priceCents,
      sortOrder: 0,
      kind: "happy_hour",
    });
    setHappyHourPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHappyHourPrice("");
    router.refresh();
  }

  async function handleDelete(variant: ItemPriceVariant) {
    setError(null);
    const result = await deleteItemPriceVariantAction(variant.id, itemId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVariants((prev) => prev.filter((v) => v.id !== variant.id));
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {error && (
        <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>{error}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <span style={sectionLabelStyle}>Size Variants</span>
        {sizeVariants.length === 0 && (
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
            No variants — this item uses just its base price.
          </p>
        )}
        {sizeVariants.map((variant) => (
          <div key={variant.id} style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
            <span style={{ flex: 1, fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>{variant.label}</span>
            <span style={{ fontFamily: "var(--font-heading)", color: "var(--accent-price)" }}>
              {formatPrice(variant.priceCents)}
            </span>
            {isOwner && (
              <Button variant="danger" size="sm" onClick={() => handleDelete(variant)}>
                Remove
              </Button>
            )}
          </div>
        ))}

        {isOwner && (
          <form onSubmit={handleAdd} style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-end", marginTop: "var(--sp-2)" }}>
            <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Half" style={{ width: 160 }} />
            <Input
              label="Price"
              prefix="$"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{ width: 140 }}
            />
            <Button type="submit" size="sm" disabled={pending || !label.trim() || !price}>
              {pending ? "Adding…" : "Add Variant"}
            </Button>
          </form>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <span style={sectionLabelStyle}>Happy Hour Price</span>
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", margin: 0 }}>
          Shown instead of the base price on screens set to Happy Hour mode. The real price never changes —
          nothing mutates on a schedule.
        </p>
        {happyHourVariant ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
            <span style={{ flex: 1, fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>
              {happyHourVariant.label}
            </span>
            <span style={{ fontFamily: "var(--font-heading)", color: "var(--accent-price)" }}>
              {formatPrice(happyHourVariant.priceCents)}
            </span>
            {isOwner && (
              <Button variant="danger" size="sm" onClick={() => handleDelete(happyHourVariant)}>
                Remove
              </Button>
            )}
          </div>
        ) : (
          isOwner && (
            <form
              onSubmit={handleSetHappyHourPrice}
              style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-end", marginTop: "var(--sp-2)" }}
            >
              <Input
                label="Happy Hour Price"
                prefix="$"
                type="number"
                step="0.01"
                value={happyHourPrice}
                onChange={(e) => setHappyHourPrice(e.target.value)}
                style={{ width: 160 }}
              />
              <Button type="submit" size="sm" disabled={happyHourPending || !happyHourPrice}>
                {happyHourPending ? "Saving…" : "Set Happy Hour Price"}
              </Button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
