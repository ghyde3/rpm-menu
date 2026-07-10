"use client";

// Featured-slot picker (M3 cleanup item 5): lets staff/owner point one item
// at a known featured slot (drink_of_the_week / dessert_of_the_day) or clear
// it, reusing the existing setFeaturedSlot/clearFeaturedSlot service (via
// the server actions in ../actions.ts -- this component adds no new
// service-layer logic). Surfaces the current holder of each slot so
// reassigning it away from another item is never a silent surprise.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { setFeaturedSlotAction, clearFeaturedSlotAction } from "../actions";

/** The two named slots the addendum/PRD describe (drink_of_the_week,
 * dessert_of_the_day). `featured_slot_key` is actually a free-text column —
 * this picker only *offers* these two plus "none", but keeps any other
 * value an item already carries selectable (see `options` below) rather
 * than silently dropping it. */
export const KNOWN_FEATURED_SLOTS: { key: string; label: string }[] = [
  { key: "drink_of_the_week", label: "Drink of the Week" },
  { key: "dessert_of_the_day", label: "Dessert of the Day" },
];

export interface FeaturedSlotHolder {
  id: string;
  name: string;
}

export interface FeaturedSlotPickerProps {
  itemId: string;
  /** This item's own `featuredSlotKey`, or null if it holds none. */
  currentSlotKey: string | null;
  /** Current holder of each known slot, keyed by slot key -- absent/undefined
   * means the slot is unclaimed. Never includes `itemId` itself. */
  holders: Record<string, FeaturedSlotHolder | undefined>;
}

function humanize(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function FeaturedSlotPicker({ itemId, currentSlotKey, holders }: FeaturedSlotPickerProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string>(currentSlotKey ?? "none");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  // If this item already holds some other slot key (the column allows any
  // lowercase snake_case value), keep it selectable so the control never
  // silently drops the item's current state.
  const options = React.useMemo(() => {
    if (currentSlotKey && !KNOWN_FEATURED_SLOTS.some((s) => s.key === currentSlotKey)) {
      return [...KNOWN_FEATURED_SLOTS, { key: currentSlotKey, label: humanize(currentSlotKey) }];
    }
    return KNOWN_FEATURED_SLOTS;
  }, [currentSlotKey]);

  const reassignWarning = React.useMemo(() => {
    if (selected === "none" || selected === currentSlotKey) return null;
    const holder = holders[selected];
    if (!holder) return null;
    return `"${holder.name}" currently holds this slot — assigning it here will clear it from that item.`;
  }, [selected, holders, currentSlotKey]);

  const dirty = selected !== (currentSlotKey ?? "none");

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result =
      selected === "none" ? await clearFeaturedSlotAction(itemId) : await setFeaturedSlotAction(itemId, selected);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
        {[{ key: "none", label: "None" }, ...options].map((opt) => {
          const active = selected === opt.key;
          const holder = opt.key !== "none" && opt.key !== currentSlotKey ? holders[opt.key] : undefined;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setSaved(false);
                setSelected(opt.key);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                padding: "6px 12px",
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
              {opt.label}
              {holder && <span style={{ opacity: 0.7, fontSize: "0.6875rem" }}>held by {holder.name}</span>}
            </button>
          );
        })}
      </div>

      {reassignWarning && (
        <p
          style={{
            color: "var(--accent-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            margin: 0,
          }}
        >
          {reassignWarning}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save Featured Slot"}
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
  );
}
