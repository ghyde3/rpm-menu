// Ported faithfully from RPM Pub Design System/components/menu/MenuSection.jsx
// (+ MenuSection.d.ts contract). A titled board block: SectionHeader + a
// stack of MenuItems.
import * as React from "react";
import { SectionHeader } from "./SectionHeader";
import { MenuItem, type MenuItemProps } from "./MenuItem";

export interface MenuSectionProps {
  title: string;
  /** Header color; defaults to hot-rod red. */
  color?: string;
  stars?: boolean;
  /** Italic fine-print intro under the header. */
  intro?: string;
  /** Data-driven rows. Omit to pass MenuItem children directly. */
  items?: MenuItemProps[];
  children?: React.ReactNode;
  headerSize?: "md" | "lg" | "xl";
  priceSize?: "sm" | "md" | "lg" | "xl";
  style?: React.CSSProperties;
}

export function MenuSection({
  title,
  color,
  stars = false,
  intro,
  items,
  children,
  headerSize = "lg",
  priceSize = "md",
  style,
}: MenuSectionProps) {
  return (
    <section style={{ ...style }}>
      <SectionHeader color={color} stars={stars} size={headerSize}>
        {title}
      </SectionHeader>
      {intro && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            fontSize: "var(--fs-body-sm)",
            color: "var(--text-muted)",
            margin: "var(--sp-3) 0 0",
            lineHeight: "var(--lh-body)",
          }}
        >
          {intro}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--row-gap)", marginTop: "var(--sp-5)" }}>
        {items ? items.map((it, i) => <MenuItem key={i} priceSize={priceSize} {...it} />) : children}
      </div>
    </section>
  );
}
