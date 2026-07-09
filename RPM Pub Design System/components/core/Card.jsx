import React from "react";

/**
 * RPM Card — matte raised panel with a hairline border and hard corners.
 * The workhorse container for CMS forms and list rows.
 */
export function Card({ children, padded = true, accent = false, style, ...rest }) {
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
