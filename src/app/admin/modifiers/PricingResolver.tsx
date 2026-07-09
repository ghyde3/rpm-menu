"use client";

// The addendum's hard fail-safe UI: an option stuck at `pricing_mode =
// 'ambiguous'` never shows a price anywhere (src/lib/pricing.ts refuses to
// render one) until a human clicks one of exactly two explicit buttons —
// "this is the new total" (-> replacement) or "this is added to base" (->
// delta). Shared between the group library's option editor
// (/admin/modifiers/[groupId]) and the per-item modifiers panel
// (/admin/items/[id]/modifiers) — both own paths, so this lives in the
// shared /admin/modifiers directory rather than being duplicated.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ds";

export type ResolvePricingFn = (input: {
  mode: "delta" | "replacement";
  cents: number;
}) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;

export interface PricingResolverProps {
  rawPriceText?: string | null;
  resolve: ResolvePricingFn;
}

export function PricingResolver({ rawPriceText, resolve }: PricingResolverProps) {
  const router = useRouter();
  const [dollars, setDollars] = React.useState(() => {
    const match = rawPriceText?.match(/\d+(\.\d{1,2})?/);
    return match ? match[0] : "";
  });
  const [pending, setPending] = React.useState<"delta" | "replacement" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick(mode: "delta" | "replacement") {
    const cents = Math.round(Number(dollars) * 100);
    if (dollars.trim() === "" || !Number.isFinite(cents) || cents < 0) {
      setError("Enter a valid price first.");
      return;
    }
    setPending(mode);
    setError(null);
    const result = await resolve({ mode, cents });
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
        padding: "var(--sp-3)",
        background: "var(--surface-inset)",
        borderRadius: "var(--radius-sm)",
        border: "var(--bw) solid var(--accent-primary)",
      }}
    >
      <span
        style={{
          color: "var(--accent-primary)",
          fontFamily: "var(--font-heading)",
          fontSize: "0.6875rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "var(--ls-wide)",
        }}
      >
        Needs pricing confirmed{rawPriceText ? ` — source: "${rawPriceText}"` : ""}
      </span>
      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <Input
          label="Price"
          prefix="$"
          type="number"
          step="0.01"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          style={{ width: 120 }}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={pending !== null || !dollars}
          onClick={() => handleClick("replacement")}
        >
          {pending === "replacement" ? "Saving…" : "This is the new total"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending !== null || !dollars}
          onClick={() => handleClick("delta")}
        >
          {pending === "delta" ? "Saving…" : "This is added to base"}
        </Button>
      </div>
      {error && (
        <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
          {error}
        </span>
      )}
    </div>
  );
}
