import React from "react";

/**
 * RPM SectionHeader — the big flame-colored board header (SANDWICHES, SALADS,
 * DESSERTS). Anton caps, hot-rod red or flame orange, optional star flankers
 * echoing the "★ BASKETS ★ DOGS" treatment on the printed board.
 */
export function SectionHeader({ children, color = "var(--accent-primary)", stars = false, align = "left", size = "lg", style }) {
  const fs = { md: "var(--fs-h3)", lg: "var(--fs-h2)", xl: "var(--fs-h1)" }[size] || "var(--fs-h2)";
  const Star = () => (
    <span style={{ color: "var(--accent-price)", fontSize: "0.6em", margin: "0 0.4em", verticalAlign: "0.18em" }}>★</span>
  );
  return (
    <h2
      style={{
        fontFamily: "var(--font-display)", fontWeight: 400,
        fontSize: fs, lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)",
        textTransform: "uppercase", color, margin: 0,
        textAlign: align, textShadow: "0 2px 0 rgba(0,0,0,0.45)",
        ...style,
      }}
    >
      {stars && <Star />}
      {children}
      {stars && <Star />}
    </h2>
  );
}
