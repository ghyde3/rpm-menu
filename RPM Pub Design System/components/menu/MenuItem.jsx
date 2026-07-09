import React from "react";
import { PriceTag } from "./PriceTag.jsx";
import { Tag } from "./Tag.jsx";

/**
 * RPM MenuItem — one board row: bold flame-orange title, dotted leader line to
 * an amber superscript price, slab-serif description beneath, optional attribute
 * tags. Unavailable items dim and strike through ("86'd").
 */
export function MenuItem({
  name,
  description,
  price,
  note,
  tags = [],
  available = true,
  leaders = true,
  priceSize = "md",
  style,
}) {
  return (
    <div style={{ opacity: available ? 1 : 0.4, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--sp-2)" }}>
        <h3
          style={{
            fontFamily: "var(--font-heading)", fontWeight: 700, fontStyle: "italic",
            fontSize: "var(--fs-title)", lineHeight: "var(--lh-snug)",
            textTransform: "uppercase", letterSpacing: "0.01em",
            color: "var(--accent-secondary)", margin: 0, whiteSpace: "nowrap",
            textDecoration: available ? "none" : "line-through",
          }}
        >
          {name}
        </h3>
        {leaders && (
          <span
            aria-hidden="true"
            style={{
              flex: 1, marginBottom: "0.35em", height: 0,
              borderBottom: "2px dotted var(--leader-dots)",
            }}
          />
        )}
        <div style={{ marginBottom: "-0.06em" }}>
          <PriceTag price={price} size={priceSize} />
        </div>
      </div>

      {description && (
        <p
          style={{
            fontFamily: "var(--font-body)", fontSize: "var(--fs-body)",
            lineHeight: "var(--lh-body)", color: "var(--text-secondary)",
            margin: "var(--sp-2) 0 0", maxWidth: "52ch",
          }}
        >
          {description}
        </p>
      )}

      {(note || tags.length > 0) && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-2)", marginTop: "var(--sp-3)" }}>
          {tags.map((t, i) =>
            typeof t === "string" ? <Tag key={i}>{t}</Tag> : <Tag key={i} tone={t.tone}>{t.label}</Tag>
          )}
          {note && (
            <span style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "var(--fs-body-sm)", color: "var(--text-muted)" }}>
              {note}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
