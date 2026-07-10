// Ported faithfully from RPM Pub Design System/components/menu/MenuItem.jsx
// (+ MenuItem.d.ts contract). One board row: title, leader, price,
// description, tags. Unavailable items dim and strike through ("86'd").
import * as React from "react";
import { PriceTag, type PriceSize } from "./PriceTag";
import { Tag, type TagTone } from "./Tag";

export interface MenuItemTag {
  label: string;
  tone?: TagTone;
}

export interface MenuItemProps {
  name: string;
  description?: string;
  /** 12.99 / "12.99" / "12" — rendered with superscript cents. Omit (undefined)
   * to render no price at all — required for the ambiguous-pricing fail-safe
   * (addendum §1): callers must not pass a price for pricing_mode=ambiguous. */
  price?: number | string;
  /** Italic aside, e.g. "sub grilled salmon 15.99" or "half 12.99". */
  note?: string;
  /** Attribute chips — plain strings or {label, tone}. */
  tags?: (string | MenuItemTag)[];
  /** false dims the row and strikes the title ("86'd"). */
  available?: boolean;
  /** Dotted leader line between title and price. */
  leaders?: boolean;
  priceSize?: PriceSize;
  /** Narrow-viewport layout (public web menu): the title wraps onto multiple
   * lines instead of running off the edge, and the price sits top-aligned in
   * a stable right-hand column so prices scan cleanly down the page. The
   * dotted leader is dropped in this mode (it reads awkwardly against a
   * wrapped, multi-line title). Defaults `false` — the TV board templates
   * keep their single-line, dotted-leader look untouched. */
  wrap?: boolean;
  style?: React.CSSProperties;
}

export function MenuItem({
  name,
  description,
  price,
  note,
  tags = [],
  available = true,
  leaders = true,
  priceSize = "md",
  wrap = false,
  style,
}: MenuItemProps) {
  const showLeaders = leaders && !wrap;
  return (
    <div style={{ opacity: available ? 1 : 0.4, ...style }}>
      <div style={{ display: "flex", alignItems: wrap ? "flex-start" : "flex-end", gap: "var(--sp-2)" }}>
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontStyle: "italic",
            fontSize: "var(--fs-title)",
            lineHeight: "var(--lh-snug)",
            textTransform: "uppercase",
            letterSpacing: "0.01em",
            color: "var(--accent-secondary)",
            margin: 0,
            // Wrap mode: take the row's free space (pushing the price to a
            // right column) and break long words rather than overflow.
            ...(wrap
              ? { flex: "1 1 auto", minWidth: 0, whiteSpace: "normal", overflowWrap: "anywhere" }
              : { whiteSpace: "nowrap" }),
            textDecoration: available ? "none" : "line-through",
          }}
        >
          {name}
        </h3>
        {showLeaders && (
          <span
            aria-hidden="true"
            style={{
              flex: 1,
              marginBottom: "0.35em",
              height: 0,
              borderBottom: "2px dotted var(--leader-dots)",
            }}
          />
        )}
        {price !== undefined && (
          <div
            style={
              wrap
                ? { flexShrink: 0, textAlign: "right", paddingTop: "0.1em" }
                : { marginBottom: "-0.06em" }
            }
          >
            <PriceTag price={price} size={priceSize} />
          </div>
        )}
      </div>

      {description && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-body)",
            lineHeight: "var(--lh-body)",
            color: "var(--text-secondary)",
            margin: "var(--sp-2) 0 0",
            maxWidth: "52ch",
          }}
        >
          {description}
        </p>
      )}

      {(note || tags.length > 0) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--sp-2)",
            marginTop: "var(--sp-3)",
          }}
        >
          {tags.map((t, i) =>
            typeof t === "string" ? (
              <Tag key={i}>{t}</Tag>
            ) : (
              <Tag key={i} tone={t.tone}>
                {t.label}
              </Tag>
            ),
          )}
          {note && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                fontSize: "var(--fs-body-sm)",
                color: "var(--text-muted)",
              }}
            >
              {note}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
