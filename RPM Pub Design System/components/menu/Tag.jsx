import React from "react";

/**
 * RPM Tag — small caps chip for item attributes: NEW, SPICY, GF, VEGGIE,
 * FAN FAVE, etc. Flat with a chunky border. Tones map to the palette.
 */
export function Tag({ children, tone = "default", style }) {
  const tones = {
    default: { color: "var(--text-secondary)", border: "var(--border-strong)", bg: "transparent" },
    new: { color: "#16240a", border: "var(--accent-new)", bg: "var(--accent-new)" },
    spicy: { color: "#fff", border: "var(--accent-primary)", bg: "var(--accent-primary)" },
    veggie: { color: "var(--accent-new)", border: "var(--accent-new)", bg: "transparent" },
    fave: { color: "var(--accent-price)", border: "var(--accent-price)", bg: "transparent" },
  };
  const t = tones[tone] || tones.default;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: "var(--font-heading)", fontSize: "0.6875rem", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "var(--ls-wide)",
        lineHeight: 1, padding: "5px 8px 4px",
        color: t.color, background: t.bg,
        border: "1.5px solid " + t.border, borderRadius: "var(--radius-sm)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
