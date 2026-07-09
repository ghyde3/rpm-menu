// Ported faithfully from RPM Pub Design System/components/menu/SectionHeader.jsx
// (+ SectionHeader.d.ts contract). Big Anton-caps board header.
import * as React from "react";

export interface SectionHeaderProps {
  children?: React.ReactNode;
  /** Header color — defaults to hot-rod red. Use flame orange for secondary sections. */
  color?: string;
  /** Flank the label with amber stars (echoes the printed board). */
  stars?: boolean;
  align?: "left" | "center" | "right";
  size?: "md" | "lg" | "xl";
  style?: React.CSSProperties;
}

function Star() {
  return (
    <span style={{ color: "var(--accent-price)", fontSize: "0.6em", margin: "0 0.4em", verticalAlign: "0.18em" }}>
      ★
    </span>
  );
}

export function SectionHeader({
  children,
  color = "var(--accent-primary)",
  stars = false,
  align = "left",
  size = "lg",
  style,
}: SectionHeaderProps) {
  const fs = { md: "var(--fs-h3)", lg: "var(--fs-h2)", xl: "var(--fs-h1)" }[size] || "var(--fs-h2)";
  return (
    <h2
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 400,
        fontSize: fs,
        lineHeight: "var(--lh-tight)",
        letterSpacing: "var(--ls-display)",
        textTransform: "uppercase",
        color,
        margin: 0,
        textAlign: align,
        textShadow: "0 2px 0 rgba(0,0,0,0.45)",
        ...style,
      }}
    >
      {stars && <Star />}
      {children}
      {stars && <Star />}
    </h2>
  );
}
