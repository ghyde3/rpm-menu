"use client";

// Lightweight, accessible multi-photo gallery for a single public-menu item
// (M4 addendum + mobile-polish M3/M4): a prominent hero image with an optional
// small thumbnail strip of additional photos beneath it. No external carousel
// library and no data fetching of its own — MenuBoard.tsx (already a Client
// Component) passes in exactly the URLs src/lib/menu/public-query.ts resolved
// server-side. Tapping the hero or any thumbnail opens the full-screen
// ImageLightbox; the only client state here is which lightbox photo is open.
import * as React from "react";
import Image from "next/image";
import type { PublicMenuGalleryPhoto } from "@/lib/menu/public-query";
import { ImageLightbox } from "./ImageLightbox";

// Deliberately larger than the pre-polish 84/22 so the row reads well at
// ~375px and the hero is a comfortable tap target.
const HERO_SIZE = 120;
const THUMB_SIZE = 34;

export interface ItemGalleryProps {
  /** Card/display-sized hero URL — always item.imageUrl (the primary photo). */
  heroUrl: string;
  /** Largest ("display") variant of the hero, for the lightbox. */
  heroDisplayUrl?: string | null;
  /** Additional, non-primary photos (already thumb+full+display URL sets). */
  photos: PublicMenuGalleryPhoto[];
  /** Used for alt text + the lightbox dialog label. */
  itemName: string;
}

/** Renders the always-present hero image plus, only when there's more than one
 * photo total, a small scrollable strip of the rest. Tapping any photo opens
 * the full-screen lightbox at that photo, from which the visitor can page
 * through the whole set. */
export function ItemGallery({ heroUrl, heroDisplayUrl, photos, itemName }: ItemGalleryProps) {
  // The hero has no separate thumb variant on hand here, so it reuses heroUrl
  // for the strip thumb; its lightbox photo prefers the display variant.
  const all = React.useMemo(
    () => [
      { thumbUrl: heroUrl, displayUrl: heroDisplayUrl || heroUrl },
      ...photos.map((p) => ({ thumbUrl: p.thumbUrl, displayUrl: p.displayUrl || p.url })),
    ],
    [heroUrl, heroDisplayUrl, photos],
  );
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setLightboxIndex(0)}
        aria-label={`View photo of ${itemName}`}
        aria-haspopup="dialog"
        style={{
          position: "relative",
          width: HERO_SIZE,
          height: HERO_SIZE,
          padding: 0,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          cursor: "pointer",
          border: "var(--bw-hair) solid var(--border-hairline)",
          background: "none",
        }}
      >
        <Image src={heroUrl} alt={itemName} fill sizes={`${HERO_SIZE}px`} style={{ objectFit: "cover" }} />
      </button>

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
              onClick={() => setLightboxIndex(i)}
              aria-label={`View photo ${i + 1} of ${all.length} for ${itemName}`}
              aria-haspopup="dialog"
              style={{
                position: "relative",
                flexShrink: 0,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                padding: 0,
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                cursor: "pointer",
                border: "var(--bw-hair) solid var(--border-hairline)",
                background: "none",
              }}
            >
              <Image src={photo.thumbUrl} alt="" fill sizes={`${THUMB_SIZE}px`} style={{ objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        photos={all}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
        itemName={itemName}
      />
    </div>
  );
}
