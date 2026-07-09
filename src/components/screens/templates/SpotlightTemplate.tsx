// §3.2 `spotlight` — 1-4 large featured items. Good for specials. Renders at
// most 4 (per spec); a manual-mode screen curated for spotlight is expected
// to hold 1-4 items already, but this guards against a query-mode screen
// accidentally matching more.
import Image from "next/image";
import { SectionHeader, MenuItem } from "@/components/ds";
import type { ScreenTemplateProps } from "./types";

const MAX_SPOTLIGHT_ITEMS = 4;

export function SpotlightTemplate({ title, accentColor, items }: ScreenTemplateProps) {
  const featured = items.slice(0, MAX_SPOTLIGHT_ITEMS);
  const columns = featured.length >= 2 ? 2 : 1;

  return (
    <div>
      <SectionHeader color={accentColor} size="xl" stars>
        {title}
      </SectionHeader>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: "var(--sp-6)",
          marginTop: "var(--sp-6)",
        }}
      >
        {featured.map((item) => (
          <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            {item.imageUrl && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  style={{ objectFit: "cover", borderRadius: "var(--radius-md)" }}
                  sizes="(max-width: 768px) 100vw, 50vw"
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
              priceSize="xl"
            />
          </div>
        ))}
        {featured.length === 0 && <EmptyState />}
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
