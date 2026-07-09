// §3.2 `list` — single column, item + price. Dense; good for beer lists.
// Text-dense by design: never renders images (§3.1a: "list stays
// text-dense").
import { SectionHeader, MenuItem } from "@/components/ds";
import type { ScreenTemplateProps } from "./types";

export function ListTemplate({ title, accentColor, items }: ScreenTemplateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <SectionHeader color={accentColor} size="xl">
        {title}
      </SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--row-gap, var(--sp-4))" }}>
        {items.map((item) => (
          <MenuItem
            key={item.id}
            name={item.name}
            description={item.description ?? undefined}
            price={item.price ?? undefined}
            note={item.priceNote ?? undefined}
            tags={item.tags}
            available={item.isAvailable}
            priceSize="lg"
          />
        ))}
        {items.length === 0 && <EmptyState />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <p style={{ fontFamily: "var(--font-body)", color: "var(--text-faint)", fontStyle: "italic" }}>
      Nothing to show on this screen yet.
    </p>
  );
}
