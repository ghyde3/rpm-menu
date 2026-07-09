// Ported faithfully from RPM Pub Design System/components/core/Card.jsx
// (+ Card.d.ts contract). Matte raised panel, hairline border, hard corners.
import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  /** Adds a thick red left rule — use to flag the active / featured panel. */
  accent?: boolean;
  children?: React.ReactNode;
}

export function Card({ children, padded = true, accent = false, style, ...rest }: CardProps) {
  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "var(--bw) solid var(--border-hairline)",
        borderLeft: accent ? "var(--bw-chunk) solid var(--accent-primary)" : undefined,
        borderRadius: "var(--radius-md)",
        padding: padded ? "var(--sp-5)" : 0,
        boxShadow: "var(--shadow-sm)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
