// §3.2 `grid` — 2-3 columns with optional images. Good for food.
import Image from "next/image";
import { SectionHeader, MenuItem, Card } from "@/components/ds";
import type { ScreenTemplateProps } from "./types";

export function GridTemplate({ title, accentColor, columns = 2, items }: ScreenTemplateProps) {
  return (
    <div>
      <SectionHeader color={accentColor} size="xl">
        {title}
      </SectionHeader>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, columns))}, 1fr)`,
          gap: "var(--sp-5)",
          marginTop: "var(--sp-5)",
        }}
      >
        {items.map((item) => (
          <Card
            key={item.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-3)",
              opacity: item.isAvailable ? 1 : 0.45,
            }}
          >
            {item.imageUrl && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", flexShrink: 0 }}>
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  style={{ objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            )}
            <MenuItem
              name={item.name}
              description={item.description ?? undefined}
              price={item.price ?? undefined}
              note={item.priceNote ?? undefined}
              tags={item.tags}
              available={item.isAvailable}
              leaders={false}
            />
          </Card>
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
