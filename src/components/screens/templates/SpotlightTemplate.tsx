// §3.2 `spotlight` — one large featured item at a time, rotated on the
// pagination timer (ScreenRenderer drives this template with exactly one item
// per "page", so a curated/matched list of any length cycles through in
// full). Each item is a full-bleed hero: the image fills the 16:9 window and
// a legible info panel (name, price, description, badges) is overlaid on a
// gradient scrim so it stays readable over any photo — and always fits,
// regardless of screen size, without relying on the height-overflow
// auto-scale that list/grid use.
import Image from "next/image";
import { SectionHeader, PriceTag, Tag } from "@/components/ds";
import type { ScreenTemplateProps } from "./types";

export function SpotlightTemplate({ title, accentColor, items }: ScreenTemplateProps) {
  const item = items[0];

  if (!item) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-base, #121110)",
        }}
      >
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-faint)", fontStyle: "italic" }}>
          Nothing to show on this screen yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--surface-base, #121110)" }}>
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          fill
          style={{ objectFit: "cover", opacity: item.isAvailable ? 1 : 0.4 }}
          sizes="100vw"
          priority
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 30%, var(--surface-raised, #1c1a18), var(--surface-base, #121110))",
          }}
        />
      )}

      {/* Top scrim + section title. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "var(--sp-6) var(--sp-7)",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.75), rgba(0,0,0,0))",
        }}
      >
        <SectionHeader color={accentColor} size="lg" stars>
          {title}
        </SectionHeader>
      </div>

      {/* Bottom scrim + info panel — always legible over any photo. */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "var(--sp-7)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-3)",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.2) 80%, rgba(0,0,0,0) 100%)",
        }}
      >
        {item.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            {item.tags.map((tag, i) => (
              <Tag key={i} tone={tag.tone}>
                {tag.label}
              </Tag>
            ))}
            {!item.isAvailable && <Tag tone="spicy">86&apos;d</Tag>}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "var(--sp-5)",
            flexWrap: "wrap",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "var(--fs-h2)",
              lineHeight: "var(--lh-tight)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
              color: "var(--text-primary)",
              textShadow: "0 2px 6px rgba(0,0,0,0.6)",
              margin: 0,
            }}
          >
            {item.name}
          </h3>
          {item.price != null ? (
            <PriceTag price={item.price} size="xl" />
          ) : item.priceNote ? (
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontStyle: "italic",
                fontSize: "var(--fs-h3)",
                color: "var(--accent-price)",
                whiteSpace: "nowrap",
              }}
            >
              {item.priceNote}
            </span>
          ) : null}
        </div>

        {item.price != null && item.priceNote && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              fontSize: "var(--fs-body)",
              color: "var(--accent-price)",
              margin: 0,
            }}
          >
            {item.priceNote}
          </p>
        )}

        {item.description && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--fs-body)",
              lineHeight: "var(--lh-normal, 1.4)",
              color: "var(--text-secondary)",
              margin: 0,
              maxWidth: "70ch",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}
