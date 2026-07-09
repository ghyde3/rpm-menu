"use client";

// Price variant (size) CRUD — addendum §2: `item_price_variants.kind`
// defaults to `size` (this editor's job); `happy_hour` variants are
// created the same way but surfaced by the M2 screens unit's happy-hour
// screen, not created here. Owner-only (§2: staff cannot change prices).
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

export function PriceVariantsEditor({ itemId, initialVariants, isOwner }: PriceVariantsEditorProps) {
  const router = useRouter();
  const [variants, setVariants] = React.useState(initialVariants);
  const [label, setLabel] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Re-sync when the server passes fresh variants after a refresh — set
  // during render (not an effect) per react-hooks/set-state-in-effect.
  const [prevInitialVariants, setPrevInitialVariants] = React.useState(initialVariants);
  if (initialVariants !== prevInitialVariants) {
    setPrevInitialVariants(initialVariants);
    setVariants(initialVariants);
  }

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
      sortOrder: variants.length,
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {error && (
        <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>{error}</p>
      )}
      {variants.length === 0 && (
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
          No variants — this item uses just its base price.
        </p>
      )}
      {variants
        .filter((v) => v.kind === "size")
        .map((variant) => (
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
  );
}
