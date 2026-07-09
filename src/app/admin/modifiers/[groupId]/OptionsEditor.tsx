"use client";

// Option CRUD for one modifier group (addendum §1). Creation only offers
// `included` / `ambiguous` pricing modes — `delta`/`replacement` are set
// exclusively via the two explicit resolve buttons (PricingResolver),
// mirroring src/lib/validation/modifiers.ts's createModifierOptionSchema.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ds";
import type { ModifierOption } from "@/db/schema";
import { formatPrice } from "@/lib/pricing";
import { createModifierOptionAction, deleteModifierOptionAction, resolveModifierOptionPricingAction } from "../actions";
import { PricingResolver } from "../PricingResolver";

export interface OptionsEditorProps {
  groupId: string;
  options: ModifierOption[];
}

function pricingLabel(option: ModifierOption): string | null {
  switch (option.pricingMode) {
    case "included":
      return "Included";
    case "delta":
      return option.priceDeltaCents != null ? `+${formatPrice(option.priceDeltaCents)}` : null;
    case "replacement":
      return option.replacementPriceCents != null ? formatPrice(option.replacementPriceCents) : null;
    default:
      return null;
  }
}

export function OptionsEditor({ groupId, options }: OptionsEditorProps) {
  const router = useRouter();
  const [label, setLabel] = React.useState("");
  const [pricingMode, setPricingMode] = React.useState<"included" | "ambiguous">("included");
  const [rawPriceText, setRawPriceText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setPending(true);
    setError(null);
    const result = await createModifierOptionAction({
      groupId,
      label: label.trim(),
      pricingMode,
      rawPriceText: pricingMode === "ambiguous" && rawPriceText.trim() ? rawPriceText.trim() : null,
      sortOrder: options.length,
      isAvailable: true,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLabel("");
    setRawPriceText("");
    router.refresh();
  }

  async function handleDelete(optionId: string) {
    setDeletingId(optionId);
    setError(null);
    const result = await deleteModifierOptionAction(optionId, groupId);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {error && (
        <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", margin: 0 }}>
          {error}
        </p>
      )}

      {options.length === 0 && (
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
          No options yet.
        </p>
      )}

      {options
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((option) => {
          const price = pricingLabel(option);
          const needsReview = option.pricingMode === "ambiguous";
          return (
            <div key={option.id} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                <span style={{ flex: 1, fontFamily: "var(--font-body)", color: option.isAvailable ? "var(--text-primary)" : "var(--text-faint)" }}>
                  {option.label}
                </span>
                {price && (
                  <span style={{ fontFamily: "var(--font-heading)", color: "var(--accent-price)", fontSize: "0.875rem" }}>
                    {price}
                  </span>
                )}
                {needsReview && (
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "var(--ls-wide)",
                      color: "var(--accent-primary)",
                    }}
                  >
                    Needs pricing
                  </span>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deletingId === option.id}
                  onClick={() => handleDelete(option.id)}
                >
                  {deletingId === option.id ? "Removing…" : "Remove"}
                </Button>
              </div>
              {needsReview && (
                <PricingResolver
                  rawPriceText={option.rawPriceText}
                  resolve={(input) => resolveModifierOptionPricingAction(option.id, groupId, input)}
                />
              )}
            </div>
          );
        })}

      <form
        onSubmit={handleAdd}
        style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-end", flexWrap: "wrap", marginTop: "var(--sp-2)" }}
      >
        <Input label="Option label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add bacon" style={{ width: 220 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <label
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
              color: "var(--text-muted)",
            }}
          >
            Pricing
          </label>
          <select
            value={pricingMode}
            onChange={(e) => setPricingMode(e.target.value as "included" | "ambiguous")}
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
            <option value="included">Included (no charge)</option>
            <option value="ambiguous">Has a price — resolve next</option>
          </select>
        </div>
        {pricingMode === "ambiguous" && (
          <Input
            label="Raw source text"
            value={rawPriceText}
            onChange={(e) => setRawPriceText(e.target.value)}
            placeholder='e.g. "$10.63"'
            style={{ width: 180 }}
          />
        )}
        <Button type="submit" size="sm" disabled={pending || !label.trim()}>
          {pending ? "Adding…" : "Add Option"}
        </Button>
      </form>
    </div>
  );
}
