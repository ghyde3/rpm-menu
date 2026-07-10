"use client";

// The addendum's per-item Modifiers section: every group that applies to
// this item (attached directly, or inherited via its category), rendered as
// read-only chips for inherited options with an "exclude for this item"
// link, plus inline pricing resolution for any option still stuck at
// `pricing_mode = 'ambiguous'` — this is the page the dashboard nag
// ("N substitution options need pricing confirmed") links into.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ds";
import { formatPrice } from "@/lib/pricing";
import type { ItemModifierView } from "@/lib/service/modifiers";
import { PricingResolver } from "@/app/admin/modifiers/PricingResolver";
import {
  attachModifierGroupToItemAction,
  detachModifierGroupFromItemAction,
  resolveModifierOptionPricingFromItemAction,
  setItemModifierOptionExclusionsAction,
} from "./actions";

export interface ItemModifiersPanelProps {
  itemId: string;
  view: ItemModifierView;
  attachableGroups: { id: string; name: string }[];
}

function chipTone(excluded: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--sp-2)",
    padding: "var(--sp-1) var(--sp-3)",
    borderRadius: "var(--radius-pill)",
    border: "var(--bw) solid " + (excluded ? "var(--border-hairline)" : "var(--border-strong)"),
    background: "transparent",
    color: excluded ? "var(--text-faint)" : "var(--text-secondary)",
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    textDecoration: excluded ? "line-through" : "none",
  };
}

export function ItemModifiersPanel({ itemId, view, attachableGroups }: ItemModifiersPanelProps) {
  const router = useRouter();
  const initialExcluded = React.useMemo(() => {
    const set = new Set<string>();
    for (const group of view.groups) {
      for (const o of group.options) {
        if (o.excluded) set.add(o.option.id);
      }
    }
    return set;
  }, [view]);

  const [excluded, setExcluded] = React.useState<Set<string>>(initialExcluded);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = React.useState("");
  const [attaching, setAttaching] = React.useState(false);
  const [detachingId, setDetachingId] = React.useState<string | null>(null);

  async function toggleExclusion(optionId: string) {
    const next = new Set(excluded);
    const wasExcluded = next.has(optionId);
    if (wasExcluded) next.delete(optionId);
    else next.add(optionId);

    setTogglingId(optionId);
    setError(null);
    const prev = excluded;
    setExcluded(next);
    const result = await setItemModifierOptionExclusionsAction(itemId, Array.from(next));
    setTogglingId(null);
    if (!result.ok) {
      setExcluded(prev);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleAttach() {
    if (!selectedGroupId) return;
    setAttaching(true);
    setError(null);
    const result = await attachModifierGroupToItemAction(itemId, selectedGroupId);
    setAttaching(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedGroupId("");
    router.refresh();
  }

  async function handleDetach(attachmentId: string) {
    setDetachingId(attachmentId);
    setError(null);
    const result = await detachModifierGroupFromItemAction(attachmentId, itemId);
    setDetachingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      {error && (
        <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", margin: 0 }}>
          {error}
        </p>
      )}

      {view.groups.length === 0 && (
        <Card>
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", margin: 0 }}>
            No modifier groups apply to this item yet — attach one below, or attach one to this item&rsquo;s whole
            category from the{" "}
            <Link href="/admin/modifiers" style={{ color: "var(--accent-primary)" }}>
              Modifiers library
            </Link>
            .
          </p>
        </Card>
      )}

      {view.groups.map((group) => (
        <Card key={group.attachmentId}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--sp-2)", marginBottom: "var(--sp-3)" }}>
            <div>
              <Link
                href={`/admin/modifiers/${group.group.id}`}
                style={{ fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}
              >
                {group.group.name}
              </Link>
              <span style={{ marginLeft: "var(--sp-2)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                {group.group.selectionType === "single" ? "Pick one" : "Pick multiple"}
                {group.group.isRequired ? " · Required" : ""}
                {" · "}
                {group.source === "item" ? "attached to this item" : "inherited from category"}
              </span>
            </div>
            {group.source === "item" && (
              <Button variant="danger" size="sm" disabled={detachingId === group.attachmentId} onClick={() => handleDetach(group.attachmentId)}>
                {detachingId === group.attachmentId ? "Detaching…" : "Detach"}
              </Button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {group.options.map(({ option, resolvedPrice }) => {
              const isExcluded = excluded.has(option.id);
              const priceLabel =
                resolvedPrice.kind === "included"
                  ? "Included"
                  : resolvedPrice.cents != null
                    ? `${resolvedPrice.kind === "delta" ? "+" : ""}${formatPrice(resolvedPrice.cents)}`
                    : null;

              return (
                <div key={option.id} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                    <span style={chipTone(group.source === "category" && isExcluded)}>
                      {option.label}
                      {priceLabel && <span style={{ color: "var(--accent-price)", fontFamily: "var(--font-heading)" }}> · {priceLabel}</span>}
                    </span>
                    {resolvedPrice.needsReview && (
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
                    {group.source === "category" && (
                      <button
                        type="button"
                        onClick={() => toggleExclusion(option.id)}
                        disabled={togglingId === option.id}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "var(--accent-primary)",
                          fontFamily: "var(--font-body)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        {togglingId === option.id ? "Saving…" : isExcluded ? "Include for this item" : "Exclude for this item"}
                      </button>
                    )}
                  </div>
                  {resolvedPrice.needsReview && (
                    <PricingResolver
                      rawPriceText={option.rawPriceText}
                      resolve={(input) => resolveModifierOptionPricingFromItemAction(option.id, itemId, input)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {attachableGroups.length > 0 && (
        <Card style={{ background: "var(--surface-inset)", boxShadow: "none" }}>
          <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", minWidth: 220 }}>
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
                Attach an existing group to this item
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                style={{
                  height: "var(--tap-target)",
                  background: "var(--surface-raised)",
                  border: "var(--bw) solid var(--border-strong)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-body)",
                  padding: "0 var(--sp-3)",
                }}
              >
                <option value="">Select…</option>
                {attachableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" disabled={!selectedGroupId || attaching} onClick={handleAttach}>
              {attaching ? "Attaching…" : "Attach"}
            </Button>
            <Link href="/admin/modifiers/new">
              <Button variant="ghost" size="sm">
                + New group
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
