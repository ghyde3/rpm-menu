"use client";

// Lightweight, accessible multi-photo gallery for a single public-menu item
// (M4 addendum): a prominent hero image with an optional small thumbnail
// strip of additional photos beneath it. No external carousel library and
// no data fetching of its own — MenuBoard.tsx (already a Client Component)
// passes in exactly the URLs src/lib/menu/public-query.ts resolved
// server-side. The only client state is which photo is currently promoted
// into the hero slot; everything else stays pure markup, so this stays
// cheap even on a board with many items.
import * as React from "react";
import Image from "next/image";
import type { PublicMenuGalleryPhoto } from "@/lib/menu/public-query";

const HERO_SIZE = 84;
const THUMB_SIZE = 22;

export interface ItemGalleryProps {
  /** Card/display-sized hero URL — always item.imageUrl (the primary photo). */
  heroUrl: string;
  /** Additional, non-primary photos (already thumb+full URL pairs). */
  photos: PublicMenuGalleryPhoto[];
  /** Used for alt text; not shown. */
  itemName: string;
}

/** Renders the always-present hero image plus, only when there's more than
 * one photo total, a small scrollable strip of the rest — clicking a
 * thumbnail promotes it into the hero slot so a visitor can flip through
 * every photo without leaving the board (a plain `useState` swap, not a
 * timed/animated carousel). */
export function ItemGallery({ heroUrl, photos, itemName }: ItemGalleryProps) {
  // [url, thumbUrl][] — the hero itself has no separate thumb variant on
  // hand here, so it reuses heroUrl for both; only matters if it's ever
  // swapped into the strip below.
  const all = React.useMemo(
    () => [{ url: heroUrl, thumbUrl: heroUrl }, ...photos],
    [heroUrl, photos],
  );
  const [active, setActive] = React.useState(0);
  const hero = all[active] ?? all[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)", flexShrink: 0 }}>
      <div
        style={{
          position: "relative",
          width: HERO_SIZE,
          height: HERO_SIZE,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          border: "var(--bw-hair) solid var(--border-hairline)",
        }}
      >
        <Image src={hero.url} alt={itemName} fill sizes={`${HERO_SIZE}px`} style={{ objectFit: "cover" }} />
      </div>

      {all.length > 1 && (
        <div
          role="group"
          aria-label={`More photos of ${itemName}`}
          style={{
            display: "flex",
            gap: "var(--sp-1)",
            overflowX: "auto",
            maxWidth: HERO_SIZE,
          }}
        >
          {all.map((photo, i) => (
            <button
              key={photo.thumbUrl + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${all.length} for ${itemName}`}
              aria-current={i === active}
              style={{
                position: "relative",
                flexShrink: 0,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                padding: 0,
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                cursor: "pointer",
                border:
                  i === active
                    ? "2px solid var(--accent-primary)"
                    : "var(--bw-hair) solid var(--border-hairline)",
                background: "none",
              }}
            >
              <Image src={photo.thumbUrl} alt="" fill sizes={`${THUMB_SIZE}px`} style={{ objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
