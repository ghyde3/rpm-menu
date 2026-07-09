// Ported faithfully from RPM Pub Design System/components/menu/Tag.jsx
// (+ Tag.d.ts contract). Small caps attribute chip.
//
// Known design-system gap (flagged in the plan): there is no gluten-free or
// non-alcoholic tone. Callers needing those (e.g. the real menu's `GF` /
// `N/A` public tags) should fall back to tone="default" rather than
// inventing an off-token color — see menu-cms-data-model-addendum.md §3.
import * as React from "react";

export type TagTone = "default" | "new" | "spicy" | "veggie" | "fave";

export interface TagProps {
  children?: React.ReactNode;
  /** Color mapping: new=green fill, spicy=red fill, veggie=green outline, fave=amber outline. */
  tone?: TagTone;
  style?: React.CSSProperties;
}

const tones: Record<TagTone, { color: string; border: string; bg: string }> = {
  default: { color: "var(--text-secondary)", border: "var(--border-strong)", bg: "transparent" },
  new: { color: "#16240a", border: "var(--accent-new)", bg: "var(--accent-new)" },
  spicy: { color: "#fff", border: "var(--accent-primary)", bg: "var(--accent-primary)" },
  veggie: { color: "var(--accent-new)", border: "var(--accent-new)", bg: "transparent" },
  fave: { color: "var(--accent-price)", border: "var(--accent-price)", bg: "transparent" },
};

export function Tag({ children, tone = "default", style }: TagProps) {
  const t = tones[tone] || tones.default;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-heading)",
        fontSize: "0.6875rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "var(--ls-wide)",
        lineHeight: 1,
        padding: "5px 8px 4px",
        color: t.color,
        background: t.bg,
        border: "1.5px solid " + t.border,
        borderRadius: "var(--radius-sm)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
