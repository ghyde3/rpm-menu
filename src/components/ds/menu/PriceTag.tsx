// Ported faithfully from RPM Pub Design System/components/menu/PriceTag.jsx
// (+ PriceTag.d.ts contract). Big dollars + raised superscript cents.
import * as React from "react";

export type PriceSize = "sm" | "md" | "lg" | "xl";

export interface PriceTagProps {
  /** 12.99, "12.99", or "12" — cents default to 99 and render as superscript. */
  price: number | string;
  /** sm=inline, md=menu row, lg=TV board, xl=hero feature. */
  size?: PriceSize;
  /** Override color; defaults to beer-amber. */
  color?: string;
  style?: React.CSSProperties;
}

const scaleBySize: Record<PriceSize, number> = { sm: 1, md: 1.375, lg: 2, xl: 3.25 };

export function PriceTag({ price, size = "md", color = "var(--accent-price)", style }: PriceTagProps) {
  // Accept number (12.99) or string ("12.99", "12", "half 12.99").
  const raw = String(price).trim();
  const num = raw.replace(/[^0-9.]/g, "");
  const [dollars, centsRaw] = num.split(".");
  const cents = (centsRaw || "").padEnd(2, "0").slice(0, 2) || "99";

  const scale = scaleBySize[size] || 1.375;
  const dollarSize = scale + "rem";
  const centSize = scale * 0.52 + "rem";

  return (
    <span
      style={{
        fontFamily: "var(--font-heading)",
        fontWeight: 700,
        color,
        whiteSpace: "nowrap",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "flex-start",
        ...style,
      }}
    >
      <span style={{ fontSize: dollarSize }}>{dollars}</span>
      <span style={{ fontSize: centSize, marginLeft: 1, marginTop: "0.06em" }}>{cents}</span>
    </span>
  );
}
