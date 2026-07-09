import React from "react";

/**
 * RPM PriceTag — renders the classic board price with superscript cents:
 * dollars big, cents small and raised (e.g. 12⁹⁹). Half-price shown inline.
 */
export function PriceTag({ price, size = "md", color = "var(--accent-price)", style }) {
  // Accept number (12.99) or string ("12.99", "12", "half 12.99").
  const raw = String(price).trim();
  const num = raw.replace(/[^0-9.]/g, "");
  const [dollars, centsRaw] = num.split(".");
  const cents = (centsRaw || "").padEnd(2, "0").slice(0, 2) || "99";

  const scale = { sm: 1, md: 1.375, lg: 2, xl: 3.25 }[size] || 1.375;
  const dollarSize = scale + "rem";
  const centSize = scale * 0.52 + "rem";

  return (
    <span
      style={{
        fontFamily: "var(--font-heading)", fontWeight: 700, color,
        whiteSpace: "nowrap", lineHeight: 1, display: "inline-flex", alignItems: "flex-start",
        ...style,
      }}
    >
      <span style={{ fontSize: dollarSize }}>{dollars}</span>
      <span style={{ fontSize: centSize, marginLeft: 1, marginTop: "0.06em" }}>{cents}</span>
    </span>
  );
}
