import React from "react";
import { SectionHeader } from "./SectionHeader.jsx";
import { MenuItem } from "./MenuItem.jsx";

/**
 * RPM MenuSection — a titled board block: SectionHeader + a stack of MenuItems.
 * Accepts an `items` array or arbitrary children. Optional intro note (the
 * fine print like "All sandwich prices include one side").
 */
export function MenuSection({ title, color, stars = false, intro, items, children, headerSize = "lg", priceSize = "md", style }) {
  return (
    <section style={{ ...style }}>
      <SectionHeader color={color} stars={stars} size={headerSize}>{title}</SectionHeader>
      {intro && (
        <p style={{
          fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "var(--fs-body-sm)",
          color: "var(--text-muted)", margin: "var(--sp-3) 0 0", lineHeight: "var(--lh-body)",
        }}>
          {intro}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--row-gap)", marginTop: "var(--sp-5)" }}>
        {items
          ? items.map((it, i) => <MenuItem key={i} priceSize={priceSize} {...it} />)
          : children}
      </div>
    </section>
  );
}
